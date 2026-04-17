import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
} from "react-native";
import { Button as PaperButton } from "react-native-paper";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  serverTimestamp,
  writeBatch,
  setDoc,
  arrayRemove,
} from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { getConversationId } from "../../utils/chatHelpers";
import { useResponsive } from "../../utils/responsive";
import OsmMapEmbed from "../../components/OsmMapEmbed";
import { useAuth } from "../../context/AuthContext";
import { getRequestSlaState } from "../../utils/requestSla";
import { blockUser, getBlockStateBetweenUsers, unblockUser } from "../../utils/userModeration";
import { canViewExactRequestLocation, getDonorLocationText, getRequestLocationText } from "../../utils/privacy";
import { getTopMatchesForRequest } from "../../utils/smartMatching";
import { syncPublicCityAvailability } from "../../utils/publicCityAvailability";
import { ensureDonorCanAcceptRequest } from "../../utils/donorAcceptance";
import { useAppDialog } from "../../hooks/useAppDialog";

export default function RequestDetailScreen({ route, navigation }: any) {
  const { requestId } = route.params;
  const { role } = useAuth();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [accepting, setAccepting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [topMatches, setTopMatches] = useState<any[]>([]);
  const currentUserId = auth.currentUser?.uid;
  const { isDesktop } = useResponsive();
  const { showDialog, dialog } = useAppDialog();

  const getCounterpartyId = () => {
    if (!currentUserId || !request) return "";
    if (request.requesterId === currentUserId) {
      return request.acceptedBy || "";
    }
    return request.requesterId || "";
  };

  const loadRequest = useCallback(async () => {
    try {
      const docRef = doc(db, "requests", requestId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setRequest({ id: docSnap.id, ...docSnap.data() });
      } else {
        Alert.alert("Error", "Request not found.");
        navigation.goBack();
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load request.");
    } finally {
      setLoading(false);
    }
  }, [navigation, requestId]);

  useEffect(() => {
    loadRequest();
  }, [loadRequest]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadTopMatches = async () => {
      if (!request?.id) return;
      if (request.status !== "pending" && request.status !== "accepted") return;
      if (role !== "admin" && request.requesterId !== currentUserId) return;

      setLoadingMatches(true);
      try {
        const matches = await getTopMatchesForRequest(
          {
            id: request.id,
            bloodTypeNeeded: request.bloodTypeNeeded,
            city: request.city,
            location: request.location,
          },
          5,
          { includePerformanceData: role === "admin" }
        );
        setTopMatches(matches);
      } catch (error) {
        console.error("Failed to load smart matches:", error);
        setTopMatches([]);
      } finally {
        setLoadingMatches(false);
      }
    };

    loadTopMatches();
  }, [currentUserId, request, role]);

  const acceptRequest = async () => {
    if (role === "admin") {
      Alert.alert("Unavailable", "Admins cannot accept blood requests.");
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }

    if (user.uid === request.requesterId) {
      Alert.alert("Cannot accept", "You cannot accept your own request.");
      return;
    }

    const eligibility = await ensureDonorCanAcceptRequest({
      db,
      userId: user.uid,
    });
    if (!eligibility.ok) {
      showDialog({
        title: eligibility.title,
        message: eligibility.message,
        tone: "warning",
        actions: [
          { label: "Close", mode: "text" },
          ...(eligibility.actionKind === "open_profile"
            ? [
                {
                  label: eligibility.actionLabel || "Open Profile",
                  mode: "contained" as const,
                  onPress: () => navigation.navigate("Profile"),
                },
              ]
            : []),
        ],
      });
      return;
    }

    showDialog({
      title: "Accept This Request?",
      message: "You’re about to accept this blood request and open a direct chat with the requester for coordination.",
      tone: "success",
      actions: [
        { label: "Cancel", mode: "text" },
        {
          label: "Yes, Accept",
          mode: "contained",
          onPress: async () => {
      setAccepting(true);
      try {
        const requestRef = doc(db, "requests", requestId);
        const latestRequestSnap = await getDoc(requestRef);
        const latestRequest = latestRequestSnap.data();

        if (!latestRequestSnap.exists()) {
          Alert.alert("Error", "This request no longer exists.");
          return;
        }

        if (latestRequest?.status !== "pending") {
          showDialog({
            title: "Request Unavailable",
            message: "This request is no longer pending.",
            tone: "warning",
          });
          return;
        }

        const donorName =
          eligibility.userData?.fullName ||
          user.displayName ||
          "A verified donor";
        const autoMessage = `Hi, I accepted your blood request for ${latestRequest.patientName || "the patient"}. I'm ready to coordinate with you here.`;

        await updateDoc(requestRef, {
          status: "accepted",
          acceptedBy: user.uid,
          acceptedAt: new Date(),
        });
        await syncPublicCityAvailability(db);

        await addDoc(collection(db, "notifications"), {
          userId: latestRequest.requesterId,
          type: "request_accepted",
          title: "A Donor Accepted Your Request",
          body: `${donorName} accepted your request for ${latestRequest.patientName || "your patient"}. Open chat to coordinate the next steps.`,
          data: { requestId },
          read: false,
          createdAt: serverTimestamp(),
        });

        const conversationId = getConversationId(user.uid, latestRequest.requesterId);
        const convRef = doc(db, "conversations", conversationId);
        const convSnap = await getDoc(convRef);
        if (!convSnap.exists()) {
          await setDoc(convRef, {
            participants: [user.uid, latestRequest.requesterId],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await addDoc(collection(db, "conversations", conversationId, "messages"), {
          senderId: user.uid,
          text: autoMessage,
          timestamp: serverTimestamp(),
          readBy: [user.uid],
          requestId,
          systemGenerated: true,
        });

        await updateDoc(convRef, {
          lastMessage: {
            text: autoMessage,
            senderId: user.uid,
            timestamp: serverTimestamp(),
            readBy: [user.uid],
          },
          hiddenFor: arrayRemove(user.uid, latestRequest.requesterId),
          updatedAt: serverTimestamp(),
        });

        showDialog({
          title: "Request Accepted",
          message: "The requester has been notified, and a chat message was sent automatically so you can coordinate right away.",
          tone: "success",
          actions: [
            {
              label: "Open Chat",
              mode: "contained",
              onPress: () => navigation.navigate("Chat", { conversationId, otherUserId: latestRequest.requesterId, requestId }),
            },
            {
              label: "Back",
              mode: "text",
              onPress: () => navigation.goBack(),
            },
          ],
        });
      } catch (error: any) {
        showDialog({
          title: "Accept Failed",
          message: error?.message || "Failed to accept request.",
          tone: "danger",
        });
      } finally {
        setAccepting(false);
      }
          },
        },
      ],
    });
  };

  const completeRequest = async () => {
    setCompleting(true);
    try {
      const completedAt = new Date();
      await updateDoc(doc(db, "requests", requestId), {
        status: "completed",
        completedAt,
      });
      await syncPublicCityAvailability(db);

      const batch = writeBatch(db);

      const requesterNotifRef = doc(collection(db, "notifications"));
      batch.set(requesterNotifRef, {
        userId: request.requesterId,
        type: "request_completed",
        title: "Request Completed",
        body: `Your blood request for ${request.patientName} has been marked as completed`,
        data: { requestId },
        read: false,
        createdAt: serverTimestamp(),
      });

      if (request.acceptedBy && request.acceptedBy !== request.requesterId) {
        const donorNotifRef = doc(collection(db, "notifications"));
        batch.set(donorNotifRef, {
          userId: request.acceptedBy,
          type: "request_completed",
          title: "Donation Completed",
          body: `Your donation for ${request.patientName} has been marked as completed`,
          data: { requestId },
          read: false,
          createdAt: serverTimestamp(),
        });
      }

      await batch.commit();

      if (request.acceptedBy) {
        const cooldownUntil = new Date(completedAt.getTime());
        cooldownUntil.setDate(cooldownUntil.getDate() + 56);

        await updateDoc(doc(db, "users", request.acceptedBy), {
          lastDonationAt: completedAt,
          donationCooldownUntil: cooldownUntil,
          availabilityStatus: "unavailable",
        });

        const certificateId = `BL-CERT-${requestId.slice(0, 6).toUpperCase()}-${completedAt.getFullYear()}`;
        await addDoc(collection(db, "donation_history"), {
          requestId,
          donorId: request.acceptedBy,
          requesterId: request.requesterId,
          patientName: request.patientName || null,
          hospital: request.hospital || null,
          city: request.city || null,
          bloodType: request.bloodTypeNeeded || null,
          urgency: request.urgency || null,
          donatedAt: completedAt,
          certificateId,
          createdAt: serverTimestamp(),
        });
      }

      Alert.alert("Success", "Request marked as completed.");
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!request) return null;

  const isOwnRequest = request.requesterId === currentUserId;
  const isAcceptedDonor = request.acceptedBy === currentUserId;
  const slaState = getRequestSlaState(request, now);
  const revealExactLocation = canViewExactRequestLocation(request, currentUserId, role);
  const requestLocationText = getRequestLocationText(request, revealExactLocation);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "Critical":
        return "#dc2626";
      case "Urgent":
        return "#ea580c";
      default:
        return "#16a34a";
    }
  };

  const openCall = async () => {
    const phone = request?.contactNumber?.trim();
    if (!phone) {
      Alert.alert("Unavailable", "No contact number provided.");
      return;
    }

    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      Alert.alert("Error", "Unable to open phone dialer.");
    }
  };

  const openSms = async () => {
    const phone = request?.contactNumber?.trim();
    if (!phone) {
      Alert.alert("Unavailable", "No contact number provided.");
      return;
    }

    try {
      await Linking.openURL(`sms:${phone}`);
    } catch {
      Alert.alert("Error", "Unable to open SMS app.");
    }
  };

  const openChat = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }

    let otherUserId = "";
    if (request.requesterId === user.uid) {
      if (!request.acceptedBy) {
        Alert.alert("No donor yet", "No donor has accepted this request yet.");
        return;
      }
      otherUserId = request.acceptedBy;
    } else {
      otherUserId = request.requesterId;
    }

    if (!otherUserId) {
      Alert.alert("Error", "Unable to open chat for this request.");
      return;
    }

    const blockState = await getBlockStateBetweenUsers(user.uid, otherUserId);
    if (blockState.blockedByMe) {
      Alert.alert("Blocked", "You blocked this user. Unblock first to continue chatting.");
      return;
    }
    if (blockState.blockedMe) {
      Alert.alert("Unavailable", "You cannot chat with this user right now.");
      return;
    }

    const conversationId = getConversationId(user.uid, otherUserId);
    const convRef = doc(db, "conversations", conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) {
      await setDoc(convRef, {
        participants: [user.uid, otherUserId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    navigation.navigate("Chat", { conversationId, otherUserId, requestId });
  };

  const handleBlockCounterparty = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }

    const counterpartyId = getCounterpartyId();
    if (!counterpartyId) {
      Alert.alert("Unavailable", "No target user available to block yet.");
      return;
    }

    const blockState = await getBlockStateBetweenUsers(user.uid, counterpartyId);
    if (blockState.blockedByMe) {
      Alert.alert("Unblock user?", "You already blocked this user.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            try {
              await unblockUser(user.uid, counterpartyId);
              Alert.alert("Updated", "User has been unblocked.");
            } catch (error: any) {
              Alert.alert("Error", error?.message || "Failed to unblock user.");
            }
          },
        },
      ]);
      return;
    }

    Alert.alert("Block user", "You will no longer receive messages from this user.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await blockUser(user.uid, counterpartyId, "request_interaction");
            Alert.alert("Blocked", "User has been blocked.");
          } catch (error: any) {
            Alert.alert("Error", error?.message || "Failed to block user.");
          }
        },
      },
    ]);
  };

  const handleReportCounterparty = async () => {
    const counterpartyId = getCounterpartyId();
    if (!counterpartyId) {
      Alert.alert("Unavailable", "No target user available to report yet.");
      return;
    }
    navigation.navigate("ReportCenter", {
      targetUserId: counterpartyId,
      requestId,
      source: "request_detail",
    });
  };

  const openRequestLocation = async () => {
    const latitude = request?.location?.latitude;
    const longitude = request?.location?.longitude;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      Alert.alert("No pinned location", "This request does not have a pinned location yet.");
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Unable to open Google Maps.");
    }
  };

  return (
    <>
    <ScrollView contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={styles.headerCard}>
        <Text style={styles.patientName}>{request.patientName}</Text>
        <Text style={styles.hospital}>Hospital: {request.hospital}</Text>
        <Text style={styles.location}>Location: {requestLocationText}</Text>
        {!revealExactLocation && (
          <Text style={styles.privacyHint}>Detailed address is hidden until request acceptance.</Text>
        )}
        <Text style={styles.bloodType}>Blood Type Needed: {request.bloodTypeNeeded}</Text>
        <Text style={[styles.urgency, { color: getUrgencyColor(request.urgency) }]}>Urgency: {request.urgency}</Text>
        <Text style={styles.contact}>Contact Number: {request.contactNumber}</Text>
        <Text style={styles.uidMeta}>Request ID: {request.id}</Text>
        <Text style={styles.uidMeta}>Requester UID: {request.requesterId || "N/A"}</Text>
        {request.acceptedBy ? <Text style={styles.uidMeta}>Accepted Donor UID: {request.acceptedBy}</Text> : null}

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Status</Text>
          <View style={[styles.statusPill, { backgroundColor: `${getUrgencyColor(request.urgency)}1A` }]}>
            <Text style={[styles.statusPillText, { color: getUrgencyColor(request.urgency) }]}>{request.status.toUpperCase()}</Text>
          </View>
        </View>
        {(request.status === "pending" || request.status === "accepted") && (
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Response Time</Text>
            <View
              style={[
                styles.slaPill,
                slaState.tone === "danger" && styles.slaPillDanger,
                slaState.tone === "warning" && styles.slaPillWarning,
              ]}
            >
              <Text
                style={[
                  styles.slaPillText,
                  slaState.tone === "danger" && styles.slaPillTextDanger,
                  slaState.tone === "warning" && styles.slaPillTextWarning,
                ]}
              >
                {slaState.label}
              </Text>
            </View>
          </View>
        )}

        {request.createdAt && <Text style={styles.timestamp}>Posted: {request.createdAt.toDate().toLocaleString()}</Text>}
        {request.acceptedAt && <Text style={styles.timestamp}>Accepted: {request.acceptedAt.toDate().toLocaleString()}</Text>}
      </View>

      {revealExactLocation &&
        typeof request?.location?.latitude === "number" &&
        typeof request?.location?.longitude === "number" && (
        <View style={styles.mapWrap}>
          <View style={styles.mapCard}>
            <OsmMapEmbed latitude={request.location.latitude} longitude={request.location.longitude} height={240} />
          </View>
          <PaperButton mode="outlined" icon="map-marker-radius" onPress={openRequestLocation} style={styles.mapButton}>
            Open Request Location in Google Maps
          </PaperButton>
        </View>
      )}

      {(role === "admin" || isOwnRequest) && (request.status === "pending" || request.status === "accepted") && (
        <View style={styles.matchCard}>
          <Text style={styles.matchTitle}>Smart Matching Queue</Text>
          <Text style={styles.matchSubtitle}>
            Auto-ranked donors by blood type, distance, availability, and response history.
          </Text>
          {loadingMatches ? (
            <ActivityIndicator size="small" />
          ) : topMatches.length === 0 ? (
            <Text style={styles.matchEmpty}>No active matches available right now.</Text>
          ) : (
            topMatches.map((item) => (
              <View key={item.id} style={styles.matchItem}>
                <Text style={styles.matchName}>{item.fullName || "Donor"}</Text>
                <Text style={styles.matchMeta}>
                  Score: {item.smartRankScore || 0} | Blood: {item.bloodType || "N/A"} | City:{" "}
                  {getDonorLocationText(item, false)}
                </Text>
                {typeof item.responseRatePercent === "number" ? (
                  <Text style={styles.matchMeta}>
                    Response: {item.responseRatePercent}% | Completed: {item.completedDonationCount || 0}
                  </Text>
                ) : null}
                {item.smartRankReasons?.length ? (
                  <Text style={styles.matchReason}>{item.smartRankReasons.join(" | ")}</Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      )}

      <View style={styles.quickActions}>
        <PaperButton mode="contained" onPress={openSms} style={styles.quickButton} buttonColor="#b91c1c">SMS</PaperButton>
        <PaperButton mode="contained" onPress={openCall} style={styles.quickButton} buttonColor="#b91c1c">Call</PaperButton>
        <PaperButton mode="contained" onPress={openChat} style={styles.quickButton} buttonColor="#991b1b">Chat</PaperButton>
      </View>

      {role !== "admin" && !isOwnRequest && (
        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>Safety Tools</Text>
          <Text style={styles.safetySubtitle}>
            Target UID: {getCounterpartyId() || "N/A"} | Reports are handled by admin in Moderation Queue.
          </Text>
          <View style={styles.moderationRow}>
            <PaperButton mode="outlined" onPress={handleBlockCounterparty}>
              Block User
            </PaperButton>
            <PaperButton mode="outlined" onPress={handleReportCounterparty}>
              Report User
            </PaperButton>
          </View>
        </View>
      )}

      {isOwnRequest && <Text style={styles.ownBadge}>This is your own request.</Text>}

      {request.status === "pending" && !isOwnRequest && role !== "admin" && (
        <PaperButton
          mode="contained"
          icon="check-circle"
          onPress={acceptRequest}
          disabled={accepting}
          loading={accepting}
          style={styles.ctaButton}
        >
          {accepting ? "Accepting..." : "Accept Request"}
        </PaperButton>
      )}

      {request.status === "accepted" && isAcceptedDonor && (
        <PaperButton
          mode="contained"
          icon="check-decagram"
          onPress={completeRequest}
          disabled={completing}
          loading={completing}
          style={styles.ctaButton}
          buttonColor="#16a34a"
        >
          {completing ? "Completing..." : "Mark as Completed"}
        </PaperButton>
      )}

      {request.status === "accepted" && !isAcceptedDonor && !isOwnRequest && (
        <Text style={styles.acceptedMessage}>This request has been accepted by another donor.</Text>
      )}

      {request.status === "pending" && role === "admin" && (
        <Text style={styles.adminHint}>Admins cannot accept requests, but can still call, SMS, and chat.</Text>
      )}

      {request.status === "completed" && (
        <Text style={styles.completedMessage}>This request has been completed.</Text>
      )}
    </ScrollView>
    {dialog}
    </>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40, backgroundColor: "#f5f5f5", gap: 10 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 14,
  },
  patientName: { fontSize: 30, fontWeight: "800", marginBottom: 10, color: "#111827" },
  hospital: { fontSize: 18, marginBottom: 8, color: "#1f2937" },
  location: { fontSize: 16, marginBottom: 8, color: "#1f2937" },
  privacyHint: { fontSize: 12, color: "#92400e", marginTop: -4, marginBottom: 8, fontWeight: "600" },
  bloodType: { fontSize: 18, marginBottom: 8, color: "#1f2937" },
  urgency: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  contact: { fontSize: 16, marginBottom: 8, color: "#1f2937" },
  uidMeta: {
    color: "#4f46e5",
    fontWeight: "700",
    fontSize: 12,
    marginBottom: 2,
  },
  metaRow: {
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaLabel: {
    color: "#6b7280",
    fontWeight: "600",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  slaPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#dcfce7",
  },
  slaPillWarning: {
    backgroundColor: "#fef3c7",
  },
  slaPillDanger: {
    backgroundColor: "#fee2e2",
  },
  slaPillText: {
    color: "#166534",
    fontSize: 11,
    fontWeight: "800",
  },
  slaPillTextWarning: {
    color: "#92400e",
  },
  slaPillTextDanger: {
    color: "#b91c1c",
  },
  timestamp: { fontSize: 13, color: "#6b7280", marginBottom: 4 },
  mapWrap: {
    gap: 8,
  },
  matchCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
    gap: 8,
  },
  matchTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#991b1b",
  },
  matchSubtitle: {
    color: "#4b5563",
    fontSize: 12,
  },
  matchItem: {
    borderWidth: 1,
    borderColor: "#f1f5f9",
    borderRadius: 8,
    padding: 8,
    backgroundColor: "#f8fafc",
  },
  matchName: {
    color: "#111827",
    fontWeight: "800",
  },
  matchMeta: {
    color: "#374151",
    fontSize: 12,
    marginTop: 1,
  },
  matchReason: {
    color: "#4b5563",
    marginTop: 2,
    fontSize: 12,
    fontStyle: "italic",
  },
  matchEmpty: {
    color: "#6b7280",
    fontWeight: "600",
  },
  quickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
    marginBottom: 4,
    gap: 10,
  },
  moderationRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  safetyCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 12,
  },
  safetyTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
  },
  safetySubtitle: {
    color: "#6b7280",
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
  },
  quickButton: {
    flex: 1,
    borderRadius: 10,
  },
  mapButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
  },
  mapCard: {
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#e8e8e8",
  },
  map: {
    width: "100%",
    height: 240,
  },
  ctaButton: {
    marginTop: 6,
    borderRadius: 10,
  },
  acceptedMessage: { marginTop: 12, color: "#15803d", fontWeight: "700" },
  completedMessage: { marginTop: 12, color: "#1d4ed8", fontWeight: "700" },
  adminHint: { marginTop: 10, color: "#991b1b", fontWeight: "700" },
  ownBadge: { marginTop: 2, color: "#6b7280", fontStyle: "italic" },
  containerDesktop: {
    maxWidth: 840,
    alignSelf: "center",
    width: "100%",
  },
});



