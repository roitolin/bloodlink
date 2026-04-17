import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from "react-native";
import { Button, Card, IconButton, Searchbar, SegmentedButtons, Text, TextInput } from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, serverTimestamp, updateDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { getRequestSlaState } from "../../utils/requestSla";
import { logAdminAction } from "../../utils/adminAuditLog";
import { autoEscalatePendingRequests, shouldEscalateRequest } from "../../utils/slaEscalation";
import { buildDonorPerformanceMap, rankDonorsForRequest } from "../../utils/smartMatching";
import { RankedDonor } from "../../utils/donorRanking";
import { createEmergencyBroadcast } from "../../utils/emergencyBroadcast";

type Request = {
  id: string;
  patientName?: string;
  hospital?: string;
  city?: string;
  locationLabel?: string | null;
  location?: { latitude?: number; longitude?: number } | null;
  bloodTypeNeeded?: string;
  urgency?: string;
  status?: string;
  acceptedBy?: string;
  escalationCount?: number;
  escalatedAt?: any;
  contactNumber?: string;
  createdAt?: any;
  slaDeadlineAt?: any;
  requesterId?: string;
};

type StatusFilter = "all" | "pending" | "accepted" | "completed";
type UrgencyFilter = "all" | "Critical" | "Urgent" | "Normal";
type EmergencyUrgency = "Critical" | "Urgent" | "Normal";

type BroadcastRecord = {
  id: string;
  message?: string;
  urgency?: EmergencyUrgency;
  status?: "active" | "resolved";
  targetCity?: string | null;
  targetBloodType?: string | null;
  createdAt?: any;
};
const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toMillis = (value: any) => toDate(value)?.getTime() || 0;

export default function AdminAllRequestsScreen() {
  const navigation = useNavigation<any>();
  const { isDesktop } = useResponsive();

  const [requests, setRequests] = useState<Request[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<Request[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingNotifCountByRequestId, setPendingNotifCountByRequestId] = useState<Record<string, number>>({});
  const [now, setNow] = useState(new Date());
  const [smartMatchPreviewByRequestId, setSmartMatchPreviewByRequestId] = useState<
    Record<string, { topName?: string; topScore?: number; totalCandidates: number }>
  >({});
  const [runningEscalation, setRunningEscalation] = useState(false);
  const [showEscalationBoard, setShowEscalationBoard] = useState(true);
  const [broadcasts, setBroadcasts] = useState<BroadcastRecord[]>([]);
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastUrgency, setBroadcastUrgency] = useState<EmergencyUrgency>("Critical");
  const [broadcastCity, setBroadcastCity] = useState("");
  const [broadcastBloodType, setBroadcastBloodType] = useState("");
  const [broadcastHours, setBroadcastHours] = useState("6");
  const [postingBroadcast, setPostingBroadcast] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const adminId = auth.currentUser?.uid;
    if (!adminId) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", adminId),
      where("read", "==", false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const counts: Record<string, number> = {};
      snapshot.docs.forEach((notificationDoc) => {
        const data = notificationDoc.data();
        if (data.type !== "request_pending") return;
        const targetRequestId = data?.data?.requestId;
        if (!targetRequestId) return;
        counts[targetRequestId] = (counts[targetRequestId] || 0) + 1;
      });
      setPendingNotifCountByRequestId(counts);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const emergencyQuery = query(collection(db, "emergency_broadcasts"), where("status", "==", "active"));
    const unsubscribe = onSnapshot(emergencyQuery, (snapshot) => {
      const list = snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as any) }) as BroadcastRecord)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      setBroadcasts(list);
    });
    return unsubscribe;
  }, []);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, "requests"));
      const list = snapshot.docs
        .map((requestDoc) => ({
          id: requestDoc.id,
          ...requestDoc.data(),
        }))
        .sort((a: any, b: any) => toMillis(b.createdAt) - toMillis(a.createdAt)) as Request[];
      setRequests(list);
      void loadSmartMatchPreviews(list);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSmartMatchPreviews = async (requestList: Request[]) => {
    try {
      const pendingRequests = requestList.filter((item) => item.status === "pending").slice(0, 40);
      if (pendingRequests.length === 0) {
        setSmartMatchPreviewByRequestId({});
        return;
      }

      const [donorsSnap, requestsSnap, historySnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "users"),
            where("donorStatus", "==", "verified"),
            where("availabilityStatus", "==", "available"),
            where("bloodType", "!=", null)
          )
        ),
        getDocs(collection(db, "requests")),
        getDocs(collection(db, "donation_history")),
      ]);

      const donors = donorsSnap.docs.map((item) => ({ id: item.id, ...(item.data() as any) })) as RankedDonor[];
      const historicalRequests = requestsSnap.docs.map((item) => item.data() as any);
      const donationHistory = historySnap.docs.map((item) => item.data() as any);
      const donorPerformance = buildDonorPerformanceMap(historicalRequests, donationHistory);

      const next: Record<string, { topName?: string; topScore?: number; totalCandidates: number }> = {};
      pendingRequests.forEach((requestItem) => {
        const ranked = rankDonorsForRequest(requestItem, donors, donorPerformance);
        const top = ranked[0];
        next[requestItem.id] = {
          topName: top?.fullName || undefined,
          topScore: top?.smartRankScore,
          totalCandidates: ranked.length,
        };
      });

      setSmartMatchPreviewByRequestId(next);
    } catch (error) {
      console.error("Failed to build smart match previews:", error);
      setSmartMatchPreviewByRequestId({});
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    const normalizedSearch = normalize(searchQuery);
    const normalizedStatusFilter = normalize(statusFilter);
    const normalizedUrgencyFilter = normalize(urgencyFilter);
    const result = requests.filter((requestItem) => {
      const statusMatches = statusFilter === "all" || normalize(requestItem.status) === normalizedStatusFilter;
      const urgencyMatches = urgencyFilter === "all" || normalize(requestItem.urgency) === normalizedUrgencyFilter;
      if (!statusMatches || !urgencyMatches) return false;
      if (!normalizedSearch) return true;

      return [
        requestItem.id,
        requestItem.patientName,
        requestItem.hospital,
        requestItem.bloodTypeNeeded,
        requestItem.city,
        requestItem.locationLabel,
        requestItem.requesterId,
        requestItem.acceptedBy,
        requestItem.urgency,
        requestItem.status,
        requestItem.contactNumber,
      ].some((value) => normalize(value).includes(normalizedSearch));
    });

    setFilteredRequests(result);
  }, [requests, searchQuery, statusFilter, urgencyFilter]);

  const deleteRequest = async (requestId: string) => {
    Alert.alert("Delete Request", "Are you sure you want to permanently delete this request?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeletingId(requestId);
          try {
            await markRequestPendingNotificationsAsRead(requestId);
            await deleteDoc(doc(db, "requests", requestId));
            await logAdminAction({
              adminId: auth.currentUser?.uid,
              action: "request_deleted",
              targetType: "request",
              targetId: requestId,
              summary: `Deleted request ${requestId}`,
            });
            setRequests((prev) => prev.filter((item) => item.id !== requestId));
            Alert.alert("Success", "Request deleted.");
          } catch (error: any) {
            Alert.alert("Error", error?.message || "Failed to delete request.");
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const runAutoEscalation = async () => {
    const adminId = auth.currentUser?.uid;
    if (!adminId) {
      Alert.alert("Error", "You must be logged in as admin.");
      return;
    }

    setRunningEscalation(true);
    try {
      const result = await autoEscalatePendingRequests(adminId);
      if (result.escalatedCount > 0) {
        await logAdminAction({
          adminId,
          action: "request_escalated",
          targetType: "request",
          summary: `Auto-escalated ${result.escalatedCount} request(s) due to response-time threshold.`,
          metadata: { requestIds: result.escalatedRequestIds },
        });
      }
      Alert.alert(
        "Response Time Alert Complete",
        result.escalatedCount > 0
          ? `${result.escalatedCount} pending request(s) were escalated.`
          : "No pending requests required escalation."
      );
      await fetchRequests();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to run auto escalation.");
    } finally {
      setRunningEscalation(false);
    }
  };

  const markRequestPendingNotificationsAsRead = async (targetRequestId: string) => {
    const adminId = auth.currentUser?.uid;
    if (!adminId) return;

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", adminId),
      where("type", "==", "request_pending"),
      where("read", "==", false)
    );

    const snapshot = await getDocs(notificationsQuery);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    let hasUpdates = false;

    snapshot.docs.forEach((notificationDoc) => {
      const data = notificationDoc.data();
      if (data?.data?.requestId === targetRequestId) {
        batch.update(notificationDoc.ref, { read: true });
        hasUpdates = true;
      }
    });

    if (hasUpdates) {
      await batch.commit();
    }
  };

  const publishEmergencyBroadcast = async () => {
    const adminId = auth.currentUser?.uid;
    if (!adminId) {
      Alert.alert("Error", "You must be logged in as admin.");
      return;
    }

    const message = broadcastMessage.trim();
    if (!message) {
      Alert.alert("Missing Message", "Please enter an emergency broadcast message.");
      return;
    }

    setPostingBroadcast(true);
    try {
      const parsedHours = Number(broadcastHours);
      const { broadcastId, recipientCount } = await createEmergencyBroadcast({
        message,
        urgency: broadcastUrgency,
        targetCity: broadcastCity.trim(),
        targetBloodType: broadcastBloodType.trim(),
        expiresInHours: Number.isFinite(parsedHours) ? parsedHours : 6,
        createdBy: adminId,
        createdByName: auth.currentUser?.email || "Admin",
      });

      await logAdminAction({
        adminId,
        action: "broadcast_created",
        targetType: "broadcast",
        targetId: broadcastId,
        summary: `Created ${broadcastUrgency} emergency broadcast.`,
        metadata: {
          targetCity: broadcastCity.trim() || null,
          targetBloodType: broadcastBloodType.trim() || null,
          recipientCount,
        },
      });

      setBroadcastMessage("");
      setBroadcastCity("");
      setBroadcastBloodType("");
      setBroadcastHours("6");
      Alert.alert("Broadcast Published", `Emergency broadcast sent to ${recipientCount} user(s).`);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to publish emergency broadcast.");
    } finally {
      setPostingBroadcast(false);
    }
  };

  const resolveEmergencyBroadcast = async (broadcast: BroadcastRecord) => {
    const adminId = auth.currentUser?.uid;
    if (!adminId) return;

    try {
      await updateDoc(doc(db, "emergency_broadcasts", broadcast.id), {
        status: "resolved",
        resolvedAt: serverTimestamp(),
        resolvedBy: adminId,
      });
      await logAdminAction({
        adminId,
        action: "broadcast_resolved",
        targetType: "broadcast",
        targetId: broadcast.id,
        summary: "Resolved emergency broadcast.",
      });
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to resolve broadcast.");
    }
  };

  const getUrgencyColor = (urgency: string | undefined) => {
    switch (urgency) {
      case "Critical":
        return "#b91c1c";
      case "Urgent":
        return "#c2410c";
      default:
        return "#15803d";
    }
  };

  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case "pending":
        return "#b45309";
      case "accepted":
        return "#15803d";
      case "completed":
        return "#1d4ed8";
      default:
        return "#6b7280";
    }
  };

  const escalationCandidates = requests
    .filter((item) => shouldEscalateRequest(item, now))
    .sort((a, b) => toMillis(a.slaDeadlineAt || a.createdAt) - toMillis(b.slaDeadlineAt || b.createdAt))
    .slice(0, 6);

  const renderRequestItem = ({ item }: { item: Request }) => {
    const pendingNotifCount = pendingNotifCountByRequestId[item.id] || 0;
    const slaState = getRequestSlaState(item, now);
    const postedAt = toDate(item.createdAt);
    const smartPreview = smartMatchPreviewByRequestId[item.id];

    return (
      <Card style={styles.requestCard} mode="elevated">
        <Card.Content>
          <View style={styles.row}>
            <View style={styles.info}>
              <View style={styles.titleRow}>
                <Text style={styles.patientName}>{item.patientName || "Unknown patient"}</Text>
                {pendingNotifCount > 0 && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{pendingNotifCount > 9 ? "9+" : pendingNotifCount}</Text>
                  </View>
                )}
              </View>
              <Text>Hospital: {item.hospital || "Unknown hospital"}</Text>
              <Text>
                Location: {item.city || "Unknown City"}
              </Text>
              {!!item.locationLabel && <Text>Address: {item.locationLabel}</Text>}
              <Text>Blood Type: {item.bloodTypeNeeded || "N/A"}</Text>
              <Text>Contact: {item.contactNumber || "N/A"}</Text>
              <Text style={{ color: getUrgencyColor(item.urgency) }}>Urgency: {item.urgency || "Normal"}</Text>
              <Text style={{ color: getStatusColor(item.status) }}>Status: {(item.status || "unknown").toUpperCase()}</Text>
              {!!item.escalationCount && item.escalationCount > 0 && (
                <Text style={styles.escalationBadge}>Escalated {item.escalationCount}x</Text>
              )}
              {(item.status === "pending" || item.status === "accepted") && (
                <Text
                  style={[
                    styles.slaText,
                    slaState.tone === "danger" && styles.slaTextDanger,
                    slaState.tone === "warning" && styles.slaTextWarning,
                  ]}
                >
                  Response Time: {slaState.label}
                </Text>
              )}
              {item.status === "pending" && smartPreview && (
                <Text style={styles.matchPreviewText}>
                  Smart Match: {smartPreview.totalCandidates} candidates
                  {smartPreview.topScore ? ` | Top ${smartPreview.topScore}/100` : ""}
                  {smartPreview.topName ? ` | ${smartPreview.topName}` : ""}
                </Text>
              )}
              <Text style={styles.date}>Posted: {postedAt ? postedAt.toLocaleString() : "No timestamp"}</Text>
            </View>
            <IconButton
              icon="delete"
              size={24}
              onPress={() => deleteRequest(item.id)}
              disabled={deletingId === item.id}
              iconColor="#dc2626"
            />
          </View>
        </Card.Content>
        <Card.Actions>
          <Button
            mode="text"
            onPress={async () => {
              await markRequestPendingNotificationsAsRead(item.id);
              navigation.navigate("RequestDetail", { requestId: item.id });
            }}
          >
            View Details
          </Button>
        </Card.Actions>
      </Card>
    );
  };

  const renderHeader = () => (
    <View>
      <Card style={styles.escalationCard} mode="elevated">
        <Card.Title
          title="Response Time Alert Board"
          subtitle="Requests nearing or past target response time are highlighted here."
          right={() => (
            <Button mode="text" compact onPress={() => setShowEscalationBoard((prev) => !prev)}>
              {showEscalationBoard ? "Hide Inputs" : "Unhide Inputs"}
            </Button>
          )}
        />
        <Card.Content>
          {showEscalationBoard ? (
            <>
              <View style={styles.escalationHeaderRow}>
                <Text style={styles.escalationHeaderText}>
                  {escalationCandidates.length > 0
                    ? `${escalationCandidates.length} request(s) require escalation attention`
                    : "No requests currently need escalation"}
                </Text>
                <Button mode="contained" compact loading={runningEscalation} disabled={runningEscalation} onPress={runAutoEscalation}>
                  Auto Escalate
                </Button>
              </View>
              {escalationCandidates.map((item) => {
                const slaState = getRequestSlaState(item, now);
                return (
                  <View key={item.id} style={styles.escalationItem}>
                    <Text style={styles.escalationItemTitle}>{item.patientName || "Unknown patient"}</Text>
                    <Text style={styles.escalationItemMeta}>
                      {item.city || "Unknown City"} | {item.bloodTypeNeeded || "N/A"} | Response Time: {slaState.label}
                    </Text>
                  </View>
                );
              })}
            </>
          ) : (
            <Text style={styles.escalationHiddenNote}>Response time alert controls are hidden. Tap Unhide Inputs to manage.</Text>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.filterCard} mode="elevated">
        <Card.Content>
          <View style={styles.filterHeaderRow}>
            <Text style={styles.filterTitle}>Request Queue</Text>
            <Button mode="text" compact onPress={fetchRequests}>
              Refresh
            </Button>
          </View>
          <Text style={styles.filterSubtitle}>
            Showing {filteredRequests.length} of {requests.length} total requests.
          </Text>
          <Searchbar
            placeholder="Search by patient, hospital, location, blood type"
            onChangeText={setSearchQuery}
            value={searchQuery}
            style={styles.searchbar}
          />
          <SegmentedButtons
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
            buttons={[
              { value: "all", label: "All" },
              { value: "pending", label: "Pending" },
              { value: "accepted", label: "Accepted" },
              { value: "completed", label: "Completed" },
            ]}
            style={styles.segmented}
          />
          <SegmentedButtons
            value={urgencyFilter}
            onValueChange={(value) => setUrgencyFilter(value as UrgencyFilter)}
            buttons={[
              { value: "all", label: "All" },
              { value: "Critical", label: "Critical" },
              { value: "Urgent", label: "Urgent" },
              { value: "Normal", label: "Normal" },
            ]}
            style={styles.segmented}
          />
        </Card.Content>
      </Card>

      <Card style={styles.emergencyCard} mode="elevated">
        <Card.Title title="Emergency Broadcast Board" subtitle="Publish urgent alerts to matching recipients." />
        <Card.Content>
          <TextInput
            mode="outlined"
            label="Emergency message"
            multiline
            value={broadcastMessage}
            onChangeText={setBroadcastMessage}
            style={styles.input}
          />
          <SegmentedButtons
            value={broadcastUrgency}
            onValueChange={(value) => setBroadcastUrgency(value as EmergencyUrgency)}
            buttons={[
              { value: "Critical", label: "Critical" },
              { value: "Urgent", label: "Urgent" },
              { value: "Normal", label: "Normal" },
            ]}
            style={styles.segmented}
          />
          <TextInput
            mode="outlined"
            label="Target city (optional)"
            value={broadcastCity}
            onChangeText={setBroadcastCity}
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label="Target blood type (optional)"
            value={broadcastBloodType}
            onChangeText={setBroadcastBloodType}
            style={styles.input}
          />
          <TextInput
            mode="outlined"
            label="Expires in hours (1-72)"
            keyboardType="number-pad"
            value={broadcastHours}
            onChangeText={setBroadcastHours}
            style={styles.input}
          />
          <Button mode="contained" loading={postingBroadcast} disabled={postingBroadcast} onPress={publishEmergencyBroadcast}>
            Publish Emergency Broadcast
          </Button>

          <View style={styles.broadcastList}>
            <Text style={styles.broadcastListTitle}>
              Active Broadcasts: {broadcasts.length}
            </Text>
            {broadcasts.slice(0, 4).map((item) => (
              <View key={item.id} style={styles.broadcastItem}>
                <Text style={styles.broadcastMessage}>{item.message || "Emergency alert"}</Text>
                <Text style={styles.broadcastMeta}>
                  {item.urgency || "Critical"} | {item.targetCity || "Nationwide"}
                  {item.targetBloodType ? ` | Blood ${item.targetBloodType}` : ""}
                </Text>
                <Button mode="text" compact onPress={() => resolveEmergencyBroadcast(item)}>
                  Mark Resolved
                </Button>
              </View>
            ))}
            {broadcasts.length === 0 ? (
              <Text style={styles.emptyBroadcasts}>No active emergency broadcasts.</Text>
            ) : null}
          </View>
        </Card.Content>
      </Card>
    </View>
  );

  if (loading && requests.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={filteredRequests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequestItem}
        refreshing={loading}
        onRefresh={fetchRequests}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={<Text style={styles.empty}>No requests match the selected filters.</Text>}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  containerDesktop: {
    maxWidth: 900,
    alignSelf: "center",
    width: "100%",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  filterCard: {
    marginBottom: 12,
    borderRadius: 14,
  },
  emergencyCard: {
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  escalationCard: {
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  escalationHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  escalationHeaderText: {
    flex: 1,
    color: "#9a3412",
    fontWeight: "700",
  },
  escalationHiddenNote: {
    color: "#7c2d12",
    fontWeight: "700",
  },
  escalationItem: {
    borderWidth: 1,
    borderColor: "#fdba74",
    borderRadius: 8,
    backgroundColor: "#fff",
    padding: 8,
    marginTop: 6,
  },
  escalationItemTitle: {
    fontWeight: "800",
    color: "#9a3412",
  },
  escalationItemMeta: {
    marginTop: 2,
    color: "#7c2d12",
    fontSize: 12,
  },
  filterHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  filterSubtitle: {
    color: "#6b7280",
    marginBottom: 10,
  },
  searchbar: {
    marginBottom: 10,
  },
  segmented: {
    marginBottom: 10,
  },
  input: {
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  broadcastList: {
    marginTop: 12,
    gap: 8,
  },
  broadcastListTitle: {
    fontWeight: "800",
    color: "#9a3412",
  },
  broadcastItem: {
    borderWidth: 1,
    borderColor: "#fed7aa",
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 8,
  },
  broadcastMessage: {
    fontWeight: "700",
    color: "#7c2d12",
  },
  broadcastMeta: {
    marginTop: 2,
    color: "#9a3412",
    fontSize: 12,
  },
  emptyBroadcasts: {
    color: "#9a3412",
    fontWeight: "600",
  },
  requestCard: {
    marginBottom: 10,
    borderRadius: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  info: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 5,
  },
  patientName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 3,
    color: "#111827",
  },
  pendingBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#d32f2f",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  pendingBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  slaText: {
    marginTop: 2,
    fontWeight: "700",
    color: "#15803d",
  },
  slaTextWarning: {
    color: "#b45309",
  },
  slaTextDanger: {
    color: "#b91c1c",
  },
  escalationBadge: {
    marginTop: 2,
    color: "#b91c1c",
    fontWeight: "800",
    fontSize: 12,
  },
  matchPreviewText: {
    marginTop: 2,
    color: "#1d4ed8",
    fontWeight: "700",
    fontSize: 12,
  },
  date: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 5,
  },
  empty: {
    textAlign: "center",
    marginTop: 30,
    color: "#6b7280",
    fontWeight: "600",
  },
});


