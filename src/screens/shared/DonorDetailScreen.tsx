import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  Linking,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button as PaperButton } from "react-native-paper";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { ensureConversationForUsers } from "../../utils/chatHelpers";
import { useResponsive } from "../../utils/responsive";
import OsmMapEmbed from "../../components/OsmMapEmbed";
import { blockUser, getBlockStateBetweenUsers, unblockUser } from "../../utils/userModeration";
import { getDonorLocationText } from "../../utils/privacy";
import { useAuth } from "../../context/AuthContext";

const maleDefault = require("../../../assets/Male_Default_Profile.png");
const femaleDefault = require("../../../assets/Female_Default_Profile.png");
const otherDefault = require("../../../assets/Male_Default_Profile.png");
const appLogo = require("../../../assets/Logo.png");

export default function DonorDetailScreen({ route, navigation }: any) {
  const { donorId } = route.params;
  const { role } = useAuth();
  const [donor, setDonor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const currentUserId = auth.currentUser?.uid;
  const isOwnProfile = currentUserId === donorId;
  const revealExactLocation = role === "admin" || isOwnProfile;
  const { isDesktop } = useResponsive();

  const loadDonor = useCallback(async () => {
    try {
      const docRef = doc(db, "users", donorId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setDonor({ id: docSnap.id, ...docSnap.data() });
      } else {
        Alert.alert("Error", "Donor not found.");
        navigation.goBack();
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load donor.");
    } finally {
      setLoading(false);
    }
  }, [donorId, navigation]);

  useEffect(() => {
    loadDonor();
  }, [loadDonor]);

  const getDefaultImage = () => {
    if (!donor) return maleDefault;
    if (donor.gender === "male") return maleDefault;
    if (donor.gender === "female") return femaleDefault;
    return otherDefault;
  };

  const callDonor = async () => {
    if (!donor?.contactNumber) {
      Alert.alert("Unavailable", "No contact number available.");
      return;
    }

    try {
      await Linking.openURL(`tel:${donor.contactNumber}`);
    } catch {
      Alert.alert("Error", "Unable to open phone dialer.");
    }
  };

  const messageDonor = async () => {
    if (!donor?.contactNumber) {
      Alert.alert("Unavailable", "No contact number available.");
      return;
    }

    try {
      await Linking.openURL(`sms:${donor.contactNumber}`);
    } catch {
      Alert.alert("Error", "Unable to open SMS app.");
    }
  };

  const openCreateRequest = () => {
    if (!donor?.bloodType) {
      Alert.alert("Unavailable", "This donor profile is missing a blood type.");
      return;
    }

    const params = {
      fromFindDonor: true,
      prefilledBloodType: donor.bloodType,
      donorContext: {
        donorId: donor.id,
        fullName: donor.fullName || "Donor",
        bloodType: donor.bloodType || "",
        contactNumber: donor.contactNumber || "",
        city: donor.city || "",
        location: donor.location || null,
      },
    };

    const routeNames = navigation.getState?.()?.routeNames || [];
    if (routeNames.includes("CreateRequest")) {
      navigation.navigate("CreateRequest", params);
      return;
    }

    const tabParent = navigation.getParent?.();
    if (tabParent) {
      tabParent.navigate("Search", {
        screen: "CreateRequest",
        params,
      });
      return;
    }

    navigation.navigate("CreateRequest", params);
  };

  const confirmCreateRequest = () => {
    if (!canRequestBlood) return;

    Alert.alert(
      "Create Request",
      `Create a blood request using ${donor?.fullName || "this donor"} as the selected donor reference?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Continue", onPress: openCreateRequest },
      ]
    );
  };

  const openPinnedLocation = async () => {
    const latitude = donor?.location?.latitude;
    const longitude = donor?.location?.longitude;

    if (typeof latitude !== "number" || typeof longitude !== "number") {
      Alert.alert("No pinned location", "This donor has not pinned a location yet.");
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Unable to open map location.");
    }
  };

  const startConversation = async () => {
    if (!donor) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }

    try {
      const blockState = await getBlockStateBetweenUsers(currentUser.uid, donor.id);
      if (blockState.blockedByMe) {
        Alert.alert("Blocked", "You blocked this user. Unblock first to continue chatting.");
        return;
      }
      if (blockState.blockedMe) {
        Alert.alert("Unavailable", "You cannot chat with this user right now.");
        return;
      }

      const conversationId = await ensureConversationForUsers(db, currentUser.uid, donor.id);

      navigation.navigate("Chat", {
        conversationId,
        otherUserId: donor.id,
      });
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Unable to open chat right now.");
    }
  };

  const handleBlockDonor = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !donor) return;

    const blockState = await getBlockStateBetweenUsers(currentUser.uid, donor.id);
    if (blockState.blockedByMe) {
      Alert.alert("Unblock user?", "You already blocked this user.", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unblock",
          onPress: async () => {
            try {
              await unblockUser(currentUser.uid, donor.id);
              Alert.alert("Updated", "User unblocked.");
            } catch (error: any) {
              Alert.alert("Error", error?.message || "Failed to unblock user.");
            }
          },
        },
      ]);
      return;
    }

    Alert.alert("Block user", "This user will not be able to chat with you.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await blockUser(currentUser.uid, donor.id, "profile_interaction");
            Alert.alert("Blocked", "User has been blocked.");
          } catch (error: any) {
            Alert.alert("Error", error?.message || "Failed to block user.");
          }
        },
      },
    ]);
  };

  const handleReportDonor = async () => {
    if (!donor) return;
    navigation.navigate("ReportCenter", {
      targetUserId: donor.id,
      source: "donor_profile",
    });
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!donor) return null;

  const isDonor = Boolean(donor.bloodType);
  const isAdminProfile = String(donor.role || "").toLowerCase() === "admin";
  const isVerifiedDonor = String(donor.donorStatus || "").toLowerCase() === "verified";
  const isAvailableNow = String(donor.availabilityStatus || "").toLowerCase() === "available";
  const hasPinnedMap =
    typeof donor?.location?.latitude === "number" &&
    typeof donor?.location?.longitude === "number";
  const canRequestBlood = role !== "admin" && !isOwnProfile && Boolean(donor.bloodType);
  const ageLabel = donor.dateOfBirth
    ? `${new Date().getFullYear() - new Date(donor.dateOfBirth).getFullYear()} years old`
    : "Not available";
  const availabilityLabel = isAvailableNow
    ? "Currently available"
    : donor.availabilityStatus
      ? String(donor.availabilityStatus).replace(/_/g, " ")
      : "Availability not set";

  return (
    <ScrollView contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={styles.profileHeader}>
        <View style={[styles.heroTopRow, isDesktop && styles.heroTopRowDesktop]}>
          <View style={styles.photoSection}>
            {isAdminProfile ? (
              <Image source={appLogo} style={styles.photo} />
            ) : donor.photoURL ? (
              <Image source={{ uri: donor.photoURL }} style={styles.photo} />
            ) : (
              <Image source={getDefaultImage()} style={styles.photo} />
            )}
          </View>

          <View style={[styles.headerInfo, isDesktop && styles.headerInfoDesktop]}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{donor.fullName || "Anonymous"}</Text>
              {isVerifiedDonor ? (
                <View style={[styles.statusPill, styles.statusPillVerified]}>
                  <Ionicons name="checkmark-circle" size={14} color="#065f46" />
                  <Text style={[styles.statusPillText, styles.statusPillTextVerified]}>Verified</Text>
                </View>
              ) : (
                <View style={[styles.statusPill, styles.statusPillPending]}>
                  <Ionicons name="time-outline" size={14} color="#92400e" />
                  <Text style={[styles.statusPillText, styles.statusPillTextPending]}>Pending Review</Text>
                </View>
              )}
            </View>

            <Text style={styles.heroSubtitle}>
              {isAdminProfile ? "LifeCycle administrator" : availabilityLabel}
            </Text>

            <View style={styles.badgeRow}>
              <View style={[styles.infoBadge, styles.infoBadgePrimary]}>
                <Ionicons name="water-outline" size={14} color="#991b1b" />
                <Text style={[styles.infoBadgeText, styles.infoBadgeTextPrimary]}>
                  {donor.bloodType || "Blood type N/A"}
                </Text>
              </View>
              <View style={styles.infoBadge}>
                <Ionicons name="location-outline" size={14} color="#4b5563" />
                <Text style={styles.infoBadgeText}>{donor.city || "Unknown city"}</Text>
              </View>
              <View style={[styles.infoBadge, isAvailableNow ? styles.infoBadgeSuccess : styles.infoBadgeMuted]}>
                <Ionicons
                  name={isAvailableNow ? "flash-outline" : "pause-outline"}
                  size={14}
                  color={isAvailableNow ? "#166534" : "#6b7280"}
                />
                <Text style={[styles.infoBadgeText, isAvailableNow && styles.infoBadgeTextSuccess]}>
                  {availabilityLabel}
                </Text>
              </View>
            </View>

            <Text style={styles.meta}>Gender: {donor.gender || "Not specified"}</Text>
            <Text style={styles.meta}>Age: {ageLabel}</Text>
            <Text style={styles.meta}>Contact: {donor.contactNumber || "Not provided"}</Text>
            {!isAdminProfile ? <Text style={styles.uidMeta}>UID: {donor.id}</Text> : null}
          </View>
        </View>

        {canRequestBlood ? (
          <PaperButton mode="contained" icon="water" onPress={confirmCreateRequest} style={styles.heroRequestButton}>
            Request Blood
          </PaperButton>
        ) : null}
      </View>

      <View style={styles.infoSection}>
        {isDonor ? (
          <>
            <Text style={styles.sectionTitle}>Donor Information</Text>

            <View style={styles.detailGrid}>
              <View style={styles.detailCard}>
                <Text style={styles.label}>Blood Type</Text>
                <Text style={styles.value}>{donor.bloodType || "Not set"}</Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.label}>Availability</Text>
                <Text style={styles.value}>{availabilityLabel}</Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.label}>City</Text>
                <Text style={styles.value}>{donor.city || "Not provided"}</Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.label}>Contact Number</Text>
                <Text style={styles.value}>{donor.contactNumber || "Not provided"}</Text>
              </View>
            </View>

            <Text style={styles.label}>Location Details</Text>
            <Text style={styles.value}>{getDonorLocationText(donor, revealExactLocation)}</Text>
            {!revealExactLocation && (
              <Text style={styles.privacyHint}>
                City details stay visible here. The donor&apos;s pinned map below helps with orientation.
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.noDonorText}>This user is not marked as an active donor right now.</Text>
        )}
      </View>

      <View style={styles.mapSection}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitleDark}>Map Preview</Text>
          {hasPinnedMap ? (
            <View style={styles.mapStatusPill}>
              <Ionicons name="pin-outline" size={14} color="#991b1b" />
              <Text style={styles.mapStatusText}>Pinned by donor</Text>
            </View>
          ) : null}
        </View>

        {hasPinnedMap ? (
          <>
            <View style={styles.mapCard}>
              <OsmMapEmbed latitude={donor.location.latitude} longitude={donor.location.longitude} height={240} />
            </View>
            <TouchableOpacity onPress={openPinnedLocation} style={styles.mapLink}>
              <Ionicons name="navigate-circle-outline" size={20} color="#d32f2f" />
              <Text style={styles.mapLinkText}>Open in Google Maps</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.noDonorText}>This donor has not shared a map pin yet.</Text>
        )}
      </View>

      {role === "admin" ? (
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Verification Files</Text>
          <Text style={styles.label}>Medical Certificate</Text>
          {donor.medicalCertificateURL ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(donor.medicalCertificateURL)}
              style={styles.certificatePresent}
            >
              <Ionicons name="document-text" size={22} color="#16a34a" />
              <Text style={styles.certificateText}>View Certificate</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.certificateMissing}>
              <Ionicons name="document-outline" size={22} color="#999" />
              <Text style={styles.certificateMissingText}>No certificate uploaded yet</Text>
            </View>
          )}

          <Text style={styles.label}>Valid ID</Text>
          {donor.validIdURL ? (
            <TouchableOpacity
              onPress={() => Linking.openURL(donor.validIdURL)}
              style={styles.certificatePresent}
            >
              <Ionicons name="card-outline" size={22} color="#16a34a" />
              <Text style={styles.certificateText}>View Valid ID</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.certificateMissing}>
              <Ionicons name="card-outline" size={22} color="#999" />
              <Text style={styles.certificateMissingText}>No valid ID uploaded yet</Text>
            </View>
          )}
        </View>
      ) : null}

      {role !== "admin" && !isOwnProfile && (
        <View style={styles.buttonContainer}>
          <View style={styles.quickActionRow}>
            <PaperButton mode="contained-tonal" onPress={callDonor} style={styles.inlineActionButton}>Call</PaperButton>
            <PaperButton mode="contained-tonal" onPress={messageDonor} style={styles.inlineActionButton}>Message</PaperButton>
          </View>
          <View style={styles.quickActionRow}>
            <PaperButton mode="contained" onPress={startConversation} style={styles.inlineActionButton}>Chat</PaperButton>
          </View>

          <View style={styles.safetyCard}>
            <Text style={styles.safetyTitle}>Safety Tools</Text>
            <Text style={styles.safetySubtitle}>Reports go to admin Moderation Queue.</Text>
            <View style={styles.moderationRow}>
              {!isAdminProfile ? (
                <PaperButton mode="outlined" onPress={handleBlockDonor} style={styles.moderationButton}>Block User</PaperButton>
              ) : (
                <PaperButton mode="outlined" disabled style={styles.moderationButton}>Admin cannot be blocked</PaperButton>
              )}
              <PaperButton mode="outlined" onPress={handleReportDonor} style={styles.moderationButton}>Report User</PaperButton>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40, backgroundColor: "#f5f5f5", gap: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  profileHeader: {
    borderRadius: 20,
    backgroundColor: "#fff",
    padding: 18,
    borderWidth: 1,
    borderColor: "#f1d6d6",
    shadowColor: "#b91c1c",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  heroTopRow: {
    gap: 16,
    alignItems: "center",
  },
  heroTopRowDesktop: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  photoSection: {
    alignItems: "center",
    justifyContent: "center",
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#d32f2f",
  },
  headerInfo: {
    width: "100%",
    justifyContent: "center",
  },
  headerInfoDesktop: {
    flex: 1,
    minWidth: 200,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  name: { fontSize: 27, fontWeight: "800", color: "#111827", flexShrink: 1 },
  heroSubtitle: {
    fontSize: 15,
    color: "#6b7280",
    marginBottom: 10,
    fontWeight: "600",
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f3f4f6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  infoBadgePrimary: {
    backgroundColor: "#fee2e2",
  },
  infoBadgeSuccess: {
    backgroundColor: "#dcfce7",
  },
  infoBadgeMuted: {
    backgroundColor: "#e5e7eb",
  },
  infoBadgeText: {
    color: "#374151",
    fontWeight: "700",
    fontSize: 12,
  },
  infoBadgeTextPrimary: {
    color: "#991b1b",
  },
  infoBadgeTextSuccess: {
    color: "#166534",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillVerified: {
    backgroundColor: "#d1fae5",
  },
  statusPillPending: {
    backgroundColor: "#fef3c7",
  },
  statusPillText: {
    fontWeight: "800",
    fontSize: 12,
  },
  statusPillTextVerified: {
    color: "#065f46",
  },
  statusPillTextPending: {
    color: "#92400e",
  },
  meta: { fontSize: 15, color: "#374151", marginBottom: 3 },
  uidMeta: { fontSize: 12, color: "#4f46e5", fontWeight: "700", marginTop: 4 },
  heroRequestButton: {
    marginTop: 16,
    borderRadius: 12,
  },
  infoSection: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 18,
    backgroundColor: "#fff",
    padding: 16,
  },
  mapSection: {
    borderWidth: 1,
    borderColor: "#f1d6d6",
    borderRadius: 18,
    backgroundColor: "#fff",
    padding: 16,
  },
  detailGrid: {
    gap: 10,
    marginTop: 4,
    marginBottom: 10,
  },
  detailCard: {
    borderRadius: 14,
    backgroundColor: "#fafafa",
    borderWidth: 1,
    borderColor: "#ececec",
    padding: 12,
  },
  label: { fontSize: 14, fontWeight: "700", marginTop: 0, color: "#6b7280" },
  value: { fontSize: 17, marginTop: 4, color: "#111827", fontWeight: "700" },
  privacyHint: { marginTop: 6, color: "#92400e", fontSize: 12, fontWeight: "600" },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 10,
    color: "#b91c1c",
  },
  sectionTitleDark: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  mapStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#fee2e2",
  },
  mapStatusText: {
    color: "#991b1b",
    fontWeight: "700",
    fontSize: 12,
  },
  noDonorText: {
    color: "#6b7280",
    fontSize: 15,
  },
  buttonContainer: {
    gap: 10,
  },
  quickActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  inlineActionButton: {
    flex: 1,
    borderRadius: 12,
  },
  moderationRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  safetyCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 12,
  },
  safetyTitle: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 15,
  },
  safetySubtitle: {
    color: "#6b7280",
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
  },
  moderationButton: {
    flex: 1,
  },
  certificatePresent: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  certificateText: {
    fontSize: 15,
    color: "#15803d",
    fontWeight: "600",
  },
  certificateMissing: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  certificateMissingText: {
    fontSize: 15,
    color: "#6b7280",
    fontStyle: "italic",
  },
  mapLink: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 4,
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#fff5f5",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mapLinkText: {
    color: "#d32f2f",
    fontWeight: "700",
  },
  mapCard: {
    marginTop: 4,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#e8e8e8",
  },
  containerDesktop: {
    maxWidth: 900,
    alignSelf: "center",
    width: "100%",
  },
});


