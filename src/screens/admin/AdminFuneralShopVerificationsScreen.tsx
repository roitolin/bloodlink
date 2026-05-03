import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Searchbar, SegmentedButtons } from "react-native-paper";
import { addDoc, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { auth, db } from "@/services";
import { useResponsive } from "@/utils/responsive";
import { logAdminAction } from "@/utils/adminAuditLog";

type ShopStatus = "none" | "pending" | "verified" | "rejected";
type FilterType = "all" | "pending" | "verified" | "rejected";

type ShopApplicant = {
  id: string;
  email?: string;
  fullName?: string;
  funeralShopStatus?: ShopStatus;
  funeralShopRejectionReason?: string | null;
  funeralShopInfo?: {
    shopName?: string;
    shopAddress?: string;
    shopPhoneNumber?: string;
  } | null;
  funeralBusinessInfo?: {
    individualRegisteredName?: string;
    businessName?: string;
    generalLocation?: string;
    registeredAddress?: string;
    zipCode?: string;
    tin?: string;
    vatRegistrationStatus?: string;
    birCertificateUrl?: string | null;
  } | null;
};

const FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
];

export default function AdminFuneralShopVerificationsScreen() {
  const { isDesktop } = useResponsive();
  const [items, setItems] = useState<ShopApplicant[]>([]);
  const [filteredItems, setFilteredItems] = useState<ShopApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("pending");
  const [selectedItem, setSelectedItem] = useState<ShopApplicant | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const applyFilters = useCallback((allItems: ShopApplicant[], search: string, filter: FilterType) => {
    let result = [...allItems];

    if (filter !== "all") result = result.filter((item) => item.funeralShopStatus === filter);

    if (search.trim()) {
      const lower = search.trim().toLowerCase();
      result = result.filter((item) =>
        [
          item.fullName,
          item.email,
          item.funeralShopInfo?.shopName,
          item.funeralBusinessInfo?.businessName,
          item.funeralBusinessInfo?.generalLocation,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(lower))
      );
    }

    setFilteredItems(result);
  }, []);

  const loadApplicants = useCallback(async () => {
    setLoading(true);
    try {
      const funeralShopQuery = query(
        collection(db, "users"),
        where("funeralShopStatus", "in", ["pending", "verified", "rejected"])
      );
      const snap = await getDocs(funeralShopQuery);
      const nextItems = snap.docs.map(
        (itemDoc) => ({ id: itemDoc.id, ...(itemDoc.data() as Omit<ShopApplicant, "id">) })
      ) as ShopApplicant[];
      setItems(nextItems);
      applyFilters(nextItems, searchQuery, filterType);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load funeral shop verifications.");
    } finally {
      setLoading(false);
    }
  }, [applyFilters, filterType, searchQuery]);

  useEffect(() => {
    void loadApplicants();
  }, [loadApplicants]);

  const closeModal = () => {
    setModalVisible(false);
    setSelectedItem(null);
    setRejectionReason("");
  };

  const notifyUser = async (userId: string, type: string, title: string, body: string) => {
    await addDoc(collection(db, "notifications"), {
      userId,
      type,
      title,
      body,
      read: false,
      createdAt: serverTimestamp(),
    });
  };

  const approveShop = async (item: ShopApplicant) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "users", item.id), {
        funeralShopStatus: "verified",
        funeralShopRejectionReason: null,
      });
      await notifyUser(
        item.id,
        "funeral_shop_approved",
        "Funeral Shop Registration Approved",
        "Your funeral shop registration has been approved."
      );
      await logAdminAction({
        adminId: auth.currentUser?.uid,
        action: "funeral_shop_approved",
        targetType: "user",
        targetId: item.id,
        summary: `Approved funeral shop registration for ${item.funeralShopInfo?.shopName || item.email || item.id}`,
      });
      Alert.alert("Success", "Funeral shop approved.");
      closeModal();
      await loadApplicants();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to approve funeral shop.");
    } finally {
      setActionLoading(false);
    }
  };

  const rejectShop = async (item: ShopApplicant) => {
    if (!rejectionReason.trim()) {
      Alert.alert("Error", "Please provide a rejection reason.");
      return;
    }

    setActionLoading(true);
    try {
      await updateDoc(doc(db, "users", item.id), {
        funeralShopStatus: "rejected",
        funeralShopRejectionReason: rejectionReason.trim(),
      });
      await notifyUser(
        item.id,
        "funeral_shop_rejected",
        "Funeral Shop Registration Rejected",
        `Your funeral shop registration was rejected. Reason: ${rejectionReason.trim()}`
      );
      await logAdminAction({
        adminId: auth.currentUser?.uid,
        action: "funeral_shop_rejected",
        targetType: "user",
        targetId: item.id,
        summary: `Rejected funeral shop registration for ${item.funeralShopInfo?.shopName || item.email || item.id}`,
        metadata: { reason: rejectionReason.trim() },
      });
      Alert.alert("Success", "Funeral shop rejected.");
      closeModal();
      await loadApplicants();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to reject funeral shop.");
    } finally {
      setActionLoading(false);
    }
  };

  const openExternalLink = async (url?: string | null) => {
    if (!url) {
      Alert.alert("Unavailable", "No file was uploaded for this record.");
      return;
    }
    await Linking.openURL(url);
  };

  const renderItem = ({ item }: { item: ShopApplicant }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => {
        setSelectedItem(item);
        setRejectionReason(item.funeralShopRejectionReason || "");
        setModalVisible(true);
      }}
    >
      <Text style={styles.itemTitle}>{item.funeralShopInfo?.shopName || "Unnamed shop"}</Text>
      <Text style={styles.itemMeta}>Owner: {item.fullName || "Unknown"}</Text>
      <Text style={styles.itemMeta}>Email: {item.email || "N/A"}</Text>
      <Text style={styles.itemMeta}>Business: {item.funeralBusinessInfo?.businessName || "N/A"}</Text>
      <Text style={styles.itemMeta}>Location: {item.funeralBusinessInfo?.generalLocation || "N/A"}</Text>
      <Text style={styles.itemMeta}>Status: {item.funeralShopStatus || "none"}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <Text style={styles.title}>Funeral Shop Verifications</Text>
      <Text style={styles.subtitle}>Review submitted funeral shop records and approve or reject them.</Text>

      <Searchbar
        placeholder="Search by shop, owner, email, or business"
        value={searchQuery}
        onChangeText={(value) => {
          setSearchQuery(value);
          applyFilters(items, value, filterType);
        }}
        style={styles.searchbar}
      />

      <SegmentedButtons
        value={filterType}
        onValueChange={(value) => {
          const nextFilter = value as FilterType;
          setFilterType(nextFilter);
          applyFilters(items, searchQuery, nextFilter);
        }}
        buttons={FILTER_OPTIONS}
      />

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>No funeral shop records found.</Text>}
      />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Review Funeral Shop</Text>
              {selectedItem ? (
                <>
                  <Text style={styles.detailText}>Shop: {selectedItem.funeralShopInfo?.shopName || "-"}</Text>
                  <Text style={styles.detailText}>Owner: {selectedItem.fullName || "-"}</Text>
                  <Text style={styles.detailText}>Email: {selectedItem.email || "-"}</Text>
                  <Text style={styles.detailText}>Phone: {selectedItem.funeralShopInfo?.shopPhoneNumber || "-"}</Text>
                  <Text style={styles.detailText}>Shop Address: {selectedItem.funeralShopInfo?.shopAddress || "-"}</Text>
                  <Text style={styles.detailText}>Business Name: {selectedItem.funeralBusinessInfo?.businessName || "-"}</Text>
                  <Text style={styles.detailText}>Registered Name: {selectedItem.funeralBusinessInfo?.individualRegisteredName || "-"}</Text>
                  <Text style={styles.detailText}>General Location: {selectedItem.funeralBusinessInfo?.generalLocation || "-"}</Text>
                  <Text style={styles.detailText}>Registered Address: {selectedItem.funeralBusinessInfo?.registeredAddress || "-"}</Text>
                  <Text style={styles.detailText}>ZIP Code: {selectedItem.funeralBusinessInfo?.zipCode || "-"}</Text>
                  <Text style={styles.detailText}>TIN: {selectedItem.funeralBusinessInfo?.tin || "-"}</Text>
                  <Text style={styles.detailText}>VAT Status: {selectedItem.funeralBusinessInfo?.vatRegistrationStatus || "-"}</Text>

                  <Button mode="outlined" onPress={() => void openExternalLink(selectedItem.funeralBusinessInfo?.birCertificateUrl)} style={styles.linkButton}>
                    View BIR Certificate
                  </Button>

                  <TextInput
                    placeholder="Rejection reason"
                    value={rejectionReason}
                    onChangeText={setRejectionReason}
                    style={styles.reasonInput}
                    multiline
                  />

                  <View style={styles.modalActions}>
                    <Button mode="contained" onPress={() => void approveShop(selectedItem)} loading={actionLoading} disabled={actionLoading}>
                      Approve
                    </Button>
                    <Button mode="contained" buttonColor="#b91c1c" onPress={() => void rejectShop(selectedItem)} loading={actionLoading} disabled={actionLoading}>
                      Reject
                    </Button>
                    <Button mode="outlined" onPress={closeModal} disabled={actionLoading}>
                      Close
                    </Button>
                  </View>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  containerDesktop: {
    maxWidth: 920,
    width: "100%",
    alignSelf: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#334155",
  },
  subtitle: {
    marginTop: 4,
    marginBottom: 12,
    color: "#4b5563",
    lineHeight: 20,
  },
  searchbar: {
    marginBottom: 10,
  },
  listContent: {
    paddingTop: 10,
    paddingBottom: 24,
    gap: 10,
  },
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  itemMeta: {
    color: "#475569",
    lineHeight: 20,
  },
  emptyText: {
    textAlign: "center",
    color: "#64748b",
    marginTop: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "88%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 12,
  },
  detailText: {
    color: "#334155",
    lineHeight: 21,
    marginBottom: 6,
  },
  linkButton: {
    marginTop: 10,
  },
  reasonInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    padding: 10,
    minHeight: 90,
    textAlignVertical: "top",
    color: "#111827",
  },
  modalActions: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
});
