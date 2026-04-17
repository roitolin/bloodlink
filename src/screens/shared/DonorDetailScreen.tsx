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
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button as PaperButton } from "react-native-paper";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { getConversationId } from "../../utils/chatHelpers";
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

    const blockState = await getBlockStateBetweenUsers(currentUser.uid, donor.id);
    if (blockState.blockedByMe) {
      Alert.alert("Blocked", "You blocked this user. Unblock first to continue chatting.");
      return;
    }
    if (blockState.blockedMe) {
      Alert.alert("Unavailable", "You cannot chat with this user right now.");
      return;
    }

    const conversationId = getConversationId(currentUser.uid, donor.id);
    const convRef = doc(db, "conversations", conversationId);
    const convSnap = await getDoc(convRef);

    if (!convSnap.exists()) {
      await setDoc(convRef, {
        participants: [currentUser.uid, donor.id],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    navigation.navigate("Chat", {
      conversationId,
      otherUserId: donor.id,
    });
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

  const isDonor = donor.bloodType && donor.availabilityStatus === "available";
  const isAdminProfile = String(donor.role || "").toLowerCase() === "admin";

  return (
    <ScrollView contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
      {navigation.canGoBack() && (
        <Pressable onPress={() => navigation.goBack()} style={styles.backLink}>
          <Text style={styles.backLinkText}>{"< Back"}</Text>
        </Pressable>
      )}

      <View style={styles.profileHeader}>
        <View style={styles.photoSection}>
          {isAdminProfile ? (
            <Image source={appLogo} style={styles.photo} />
          ) : donor.photoURL ? (
            <Image source={{ uri: donor.photoURL }} style={styles.photo} />
          ) : (
            <Image source={getDefaultImage()} style={styles.photo} />
          )}
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.name}>{donor.fullName || "Anonymous"}</Text>
          <Text style={styles.meta}>Gender: {donor.gender || "Not specified"}</Text>
          <Text style={styles.meta}>
            Age: {donor.dateOfBirth ? `${new Date().getFullYear() - new Date(donor.dateOfBirth).getFullYear()} years` : "Not available"}
          </Text>
          <Text style={styles.meta}>Contact: {donor.contactNumber || "Not provided"}</Text>
          {!isAdminProfile ? <Text style={styles.uidMeta}>UID: {donor.id}</Text> : null}
        </View>
      </View>

      <View style={styles.infoSection}>
        {isDonor ? (
          <>
            <Text style={styles.sectionTitle}>Donor Information</Text>
            <Text style={styles.label}>Blood Type</Text>
            <Text style={styles.value}>{donor.bloodType}</Text>

            <Text style={styles.label}>Location</Text>
            <Text style={styles.value}>{getDonorLocationText(donor, revealExactLocation)}</Text>
            {!revealExactLocation && (
              <Text style={styles.privacyHint}>Detailed address is hidden for privacy until a request is accepted.</Text>
            )}

            {revealExactLocation &&
              typeof donor?.location?.latitude === "number" &&
              typeof donor?.location?.longitude === "number" && (
              <>
                <View style={styles.mapCard}>
                  <OsmMapEmbed latitude={donor.location.latitude} longitude={donor.location.longitude} height={240} />
                </View>
                <TouchableOpacity onPress={openPinnedLocation} style={styles.mapLink}>
                  <Ionicons name="navigate-circle-outline" size={20} color="#d32f2f" />
                  <Text style={styles.mapLinkText}>Open in Google Maps</Text>
                </TouchableOpacity>
              </>
            )}

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
                <Text style={styles.certificateMissingText}>No certificate</Text>
              </View>
            )}
          </>
        ) : (
          <Text style={styles.noDonorText}>This user is not marked as an active donor right now.</Text>
        )}
      </View>

      {role !== "admin" && !isOwnProfile && (
        <View style={styles.buttonContainer}>
          <PaperButton mode="contained-tonal" onPress={callDonor} style={styles.actionButton}>Call</PaperButton>
          <PaperButton mode="contained-tonal" onPress={messageDonor} style={styles.actionButton}>Message (SMS)</PaperButton>
          <PaperButton mode="contained" onPress={startConversation} style={styles.actionButton}>Chat</PaperButton>
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
  container: { padding: 20, paddingBottom: 40, backgroundColor: "#f5f5f5", gap: 10 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  backLink: {
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  backLinkText: {
    color: "#6b7280",
    fontWeight: "700",
  },
  profileHeader: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 14,
    flexDirection: "row",
    gap: 14,
    flexWrap: "wrap",
  },
  photoSection: {
    alignItems: "center",
    justifyContent: "center",
  },
  photo: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderColor: "#d32f2f",
  },
  headerInfo: {
    flex: 1,
    minWidth: 220,
    justifyContent: "center",
  },
  name: { fontSize: 28, fontWeight: "800", color: "#111827", marginBottom: 8 },
  meta: { fontSize: 16, color: "#374151", marginBottom: 4 },
  uidMeta: { fontSize: 12, color: "#4f46e5", fontWeight: "700", marginTop: 4 },
  infoSection: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#fff",
    padding: 14,
  },
  label: { fontSize: 15, fontWeight: "700", marginTop: 10, color: "#4b5563" },
  value: { fontSize: 17, marginTop: 3, color: "#111827" },
  privacyHint: { marginTop: 2, color: "#92400e", fontSize: 12, fontWeight: "600" },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
    color: "#b91c1c",
  },
  noDonorText: {
    color: "#6b7280",
    fontSize: 15,
  },
  buttonContainer: {
    marginTop: 2,
    gap: 8,
  },
  actionButton: {
    borderRadius: 10,
  },
  moderationRow: {
    flexDirection: "row",
    gap: 8,
  },
  safetyCard: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    backgroundColor: "#fff",
    padding: 10,
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
    marginTop: 8,
    marginBottom: 4,
    gap: 6,
  },
  mapLinkText: {
    color: "#d32f2f",
    fontWeight: "600",
  },
  mapCard: {
    marginTop: 8,
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
  containerDesktop: {
    maxWidth: 900,
    alignSelf: "center",
    width: "100%",
  },
});


