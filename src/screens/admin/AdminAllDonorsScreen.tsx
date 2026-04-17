import { useState, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import {
  Card,
  Text,
  Searchbar,
  IconButton,
  SegmentedButtons,
} from "react-native-paper";
import { useNavigation } from "@react-navigation/native";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { logAdminAction } from "../../utils/adminAuditLog";

type Donor = {
  id: string;
  fullName?: string;
  email: string;
  bloodType?: string;
  city?: string;
  donorStatus?: "none" | "pending" | "verified" | "rejected";
  donorVerificationRejectionReason?: string | null;
  medicalCertificateURL?: string;
  photoURL?: string;
};

type FilterType = "all" | "pending" | "verified" | "rejected";

export default function AdminAllDonorsScreen() {
  const navigation = useNavigation<any>();
  const [donors, setDonors] = useState<Donor[]>([]);
  const [filteredDonors, setFilteredDonors] = useState<Donor[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingNotifCountByUserId, setPendingNotifCountByUserId] = useState<Record<string, number>>({});
  const { isDesktop } = useResponsive();

  const applyFilters = useCallback((
    allDonors: Donor[],
    search: string,
    filter: FilterType
  ) => {
    let result = [...allDonors];

    if (filter !== "all") {
      result = result.filter((d) => d.donorStatus === filter);
    }

    if (search.trim() !== "") {
      const lower = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.fullName?.toLowerCase().includes(lower) ||
          d.email?.toLowerCase().includes(lower) ||
          d.bloodType?.toLowerCase().includes(lower) ||
          d.city?.toLowerCase().includes(lower)
      );
    }

    setFilteredDonors(result);
  }, []);

  const fetchDonors = useCallback(async () => {
    try {
      const q = query(collection(db, "users"), where("bloodType", "!=", null));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Donor[];
      setDonors(list);
      applyFilters(list, searchQuery, filterType);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load donors.");
    } finally {
      setLoading(false);
    }
  }, [applyFilters, filterType, searchQuery]);

  useEffect(() => {
    fetchDonors();
  }, [fetchDonors]);

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
        if (data.type !== "donor_pending") return;
        const targetUserId = data?.data?.userId;
        if (!targetUserId) return;
        counts[targetUserId] = (counts[targetUserId] || 0) + 1;
      });
      setPendingNotifCountByUserId(counts);
    });

    return unsubscribe;
  }, []);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    applyFilters(donors, query, filterType);
  };

  const changeFilter = (filter: FilterType) => {
    setFilterType(filter);
    applyFilters(donors, searchQuery, filter);
  };

  const approveDonor = async (donor: Donor) => {
    setUpdatingId(donor.id);
    try {
      await updateDoc(doc(db, "users", donor.id), {
        donorStatus: "verified",
        donorVerificationRejectionReason: null,
      });
      await markDonorPendingNotificationsAsRead(donor.id);
      const updatedDonors = donors.map((d) =>
        d.id === donor.id
          ? { ...d, donorStatus: "verified" as const, donorVerificationRejectionReason: null }
          : d
      );
      setDonors(updatedDonors);
      applyFilters(updatedDonors, searchQuery, filterType);
      await logAdminAction({
        adminId: auth.currentUser?.uid,
        action: "donor_approved",
        targetType: "user",
        targetId: donor.id,
        summary: `Approved donor verification for ${donor.fullName || donor.email || donor.id}`,
        metadata: { donorEmail: donor.email || null },
      });
      Alert.alert("Success", "Donor approved.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const rejectDonor = async (donor: Donor, reason: string) => {
    if (!reason) {
      Alert.alert("Error", "Please provide a reason.");
      return;
    }
    setUpdatingId(donor.id);
    try {
      await updateDoc(doc(db, "users", donor.id), {
        donorStatus: "rejected",
        donorVerificationRejectionReason: reason,
      });
      await markDonorPendingNotificationsAsRead(donor.id);
      const updatedDonors = donors.map((d) =>
        d.id === donor.id
          ? { ...d, donorStatus: "rejected" as const, donorVerificationRejectionReason: reason }
          : d
      );
      setDonors(updatedDonors);
      applyFilters(updatedDonors, searchQuery, filterType);
      await logAdminAction({
        adminId: auth.currentUser?.uid,
        action: "donor_rejected",
        targetType: "user",
        targetId: donor.id,
        summary: `Rejected donor verification for ${donor.fullName || donor.email || donor.id}`,
        metadata: { reason },
      });
      Alert.alert("Success", "Donor rejected.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteDonorData = async (donor: Donor) => {
    Alert.alert(
      "Confirm Delete",
      `Are you sure you want to delete donor data for ${donor.fullName || donor.email}? This will remove their donor fields (blood type, location, etc.) but keep the user account.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setUpdatingId(donor.id);
            try {
              await markDonorPendingNotificationsAsRead(donor.id);
              await updateDoc(doc(db, "users", donor.id), {
                bloodType: null,
                city: null,
                street: null,
                medicalCertificateURL: null,
                donorStatus: "none",
                donorVerificationRejectionReason: null,
                availabilityStatus: null,
                availableSince: null,
              });
              const updatedDonors = donors.filter((d) => d.id !== donor.id);
              setDonors(updatedDonors);
              applyFilters(updatedDonors, searchQuery, filterType);
              await logAdminAction({
                adminId: auth.currentUser?.uid,
                action: "donor_data_deleted",
                targetType: "user",
                targetId: donor.id,
                summary: `Deleted donor data fields for ${donor.fullName || donor.email || donor.id}`,
              });
              Alert.alert("Success", "Donor data removed.");
            } catch (error: any) {
              Alert.alert("Error", error.message);
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  const markDonorPendingNotificationsAsRead = async (targetUserId: string) => {
    const adminId = auth.currentUser?.uid;
    if (!adminId) return;

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", adminId),
      where("type", "==", "donor_pending"),
      where("read", "==", false)
    );

    const snapshot = await getDocs(notificationsQuery);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    let hasUpdates = false;

    snapshot.docs.forEach((notificationDoc) => {
      const data = notificationDoc.data();
      if (data?.data?.userId === targetUserId) {
        batch.update(notificationDoc.ref, { read: true });
        hasUpdates = true;
      }
    });

    if (hasUpdates) {
      await batch.commit();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "verified": return "✅ Verified";
      case "pending": return "⏳ Pending";
      case "rejected": return "❌ Rejected";
      default: return "Not a donor";
    }
  };

  const renderItem = ({ item }: { item: Donor }) => {
    const isPending = item.donorStatus === "pending";
    const pendingNotifCount = pendingNotifCountByUserId[item.id] || 0;

    return (
      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <View style={styles.row}>
            <View style={styles.info}>
              <View style={styles.titleRow}>
                <Text style={styles.name}>{item.fullName || "No name"}</Text>
                {pendingNotifCount > 0 && (
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>{pendingNotifCount > 9 ? "9+" : pendingNotifCount}</Text>
                  </View>
                )}
              </View>
              <Text>Email: {item.email}</Text>
              <Text>Blood Type: {item.bloodType}</Text>
              <Text>Location: {item.city || "N/A"}</Text>
              <Text>Status: {getStatusBadge(item.donorStatus || "none")}</Text>
              {item.donorStatus === "rejected" && item.donorVerificationRejectionReason && (
                <Text style={styles.reason}>Reason: {item.donorVerificationRejectionReason}</Text>
              )}
            </View>
            <View style={styles.actions}>
              {isPending ? (
                <>
                  <IconButton
                    icon="check"
                    size={24}
                    onPress={() => approveDonor(item)}
                    disabled={updatingId === item.id}
                    iconColor="green"
                  />
                  <IconButton
                    icon="close"
                    size={24}
                    onPress={() => {
                      Alert.prompt(
                        "Reject Donor",
                        "Please provide a reason:",
                        (reason) => rejectDonor(item, reason || "No reason provided")
                      );
                    }}
                    disabled={updatingId === item.id}
                    iconColor="red"
                  />
                </>
              ) : (
                <IconButton
                  icon="eye"
                  size={24}
                  onPress={async () => {
                    await markDonorPendingNotificationsAsRead(item.id);
                    navigation.navigate("AdminUserDetail", { userId: item.id });
                  }}
                />
              )}
              <IconButton
                icon="delete"
                size={24}
                onPress={() => deleteDonorData(item)}
                disabled={updatingId === item.id}
                iconColor="red"
              />
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <Searchbar
        placeholder="Search by name, email, blood type, city"
        onChangeText={handleSearch}
        value={searchQuery}
        style={styles.searchbar}
      />
      <SegmentedButtons
        value={filterType}
        onValueChange={(value) => changeFilter(value as FilterType)}
        buttons={[
          { value: "all", label: "All" },
          { value: "pending", label: "Pending" },
          { value: "verified", label: "Verified" },
          { value: "rejected", label: "Rejected" },
        ]}
        style={styles.segmented}
      />
      <FlatList
        data={filteredDonors}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshing={loading}
        onRefresh={fetchDonors}
        ListEmptyComponent={<Text style={styles.empty}>No donors match the criteria.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  searchbar: { marginBottom: 15 },
  segmented: { marginBottom: 15 },
  card: { marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  info: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 5 },
  name: { fontSize: 16, fontWeight: "bold", marginBottom: 5 },
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
  reason: { fontSize: 12, color: "red", fontStyle: "italic", marginTop: 4 },
  actions: { flexDirection: "row", alignItems: "center" },
  empty: { textAlign: "center", marginTop: 50, fontSize: 16 },
  containerDesktop: { maxWidth: 800, alignSelf: "center", width: "100%" },
});

