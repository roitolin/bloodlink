import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "@/services";

type FuneralServiceRequest = {
  id: string;
  requesterId: string;
  shopId: string;
  shopName: string;
  shopContactNumber?: string | null;
  shopAddress?: string | null;
  productName: string;
  productImageUrl?: string | null;
  variationName?: string | null;
  requestType?: string;
  customDesignNotes?: string | null;
  memorialPhotoUrl?: string | null;
  deceasedFullName: string;
  deceasedAge?: number | null;
  tributeMessage: string;
  familyCoordinatorName: string;
  wakeAddress: string;
  pickupAddress: string;
  contactNumber: string;
  status: string;
  createdAt?: any;
  acceptedAt?: any;
  declinedAt?: any;
};

const getStatusMeta = (status: string) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "accepted_by_shop") {
    return {
      label: "Accepted by Shop",
      background: "#e7f5ec",
      text: "#166534",
      message: "The shop accepted your request. You may wait for their next coordination step.",
    };
  }
  if (normalized === "declined_by_shop") {
    return {
      label: "Declined",
      background: "#fde8e8",
      text: "#991b1b",
      message: "This request was declined by the shop.",
    };
  }
  return {
    label: "Waiting for Shop",
    background: "#fef3c7",
    text: "#92400e",
    message: "Your request has been sent. Please wait while the shop reviews it.",
  };
};

const formatTimestamp = (value: any) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString();
};

export default function FuneralMyServiceRequestsScreen() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<FuneralServiceRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<FuneralServiceRequest | null>(null);

  const openPhoneLink = useCallback(async (mode: "call" | "sms", rawPhone: string | null | undefined) => {
    const phone = String(rawPhone || "").trim();
    if (!phone) return;

    try {
      await Linking.openURL(`${mode === "call" ? "tel" : "sms"}:${phone.replace(/\s+/g, "")}`);
    } catch {
      // Keep interaction quiet if the device cannot open it.
    }
  }, []);

  const loadRequests = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, "funeral_service_requests"), where("requesterId", "==", user.uid)));
      const nextRequests = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }) as FuneralServiceRequest)
        .sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
      setRequests(nextRequests);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
    }, [loadRequests])
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <Text style={styles.headerEyebrow}>My Service Requests</Text>
          <Text style={styles.headerTitle}>Request Tracker</Text>
          <Text style={styles.headerSubtitle}>Monitor your submitted arrangements and wait for the shop’s response here.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#92400e" />
            <Text style={styles.loadingText}>Loading your requests...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={28} color="#8b8578" />
            <Text style={styles.emptyTitle}>No service requests yet</Text>
            <Text style={styles.emptyText}>Once you send a funeral service request, it will appear here for tracking.</Text>
          </View>
        ) : (
          requests.map((item) => {
            const statusMeta = getStatusMeta(item.status);
            return (
              <TouchableOpacity key={item.id} style={styles.requestCard} activeOpacity={0.92} onPress={() => setSelectedRequest(item)}>
                <View style={styles.requestTopRow}>
                  <View style={styles.requestTextBlock}>
                    <Text style={styles.requestName}>{item.deceasedFullName}</Text>
                    <Text style={styles.requestShop}>{item.shopName}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusMeta.background }]}>
                    <Text style={[styles.statusBadgeText, { color: statusMeta.text }]}>{statusMeta.label}</Text>
                  </View>
                </View>
                <Text style={styles.requestMeta}>Service: {item.productName}</Text>
                <Text style={styles.requestMeta}>Sent: {formatTimestamp(item.createdAt)}</Text>
                <Text style={[styles.requestMeta, styles.requestMessage]}>{statusMeta.message}</Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={Boolean(selectedRequest)} transparent animationType="fade" onRequestClose={() => setSelectedRequest(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSelectedRequest(null)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            {selectedRequest ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>{selectedRequest.deceasedFullName}</Text>
                <Text style={styles.modalSubtitle}>{selectedRequest.shopName}</Text>
                {selectedRequest.productImageUrl ? (
                  <Image source={{ uri: selectedRequest.productImageUrl }} style={styles.modalItemImage} resizeMode="cover" />
                ) : null}
                {selectedRequest.memorialPhotoUrl ? (
                  <Image source={{ uri: selectedRequest.memorialPhotoUrl }} style={styles.modalImage} resizeMode="cover" />
                ) : null}

                <Text style={styles.detailLabel}>Status</Text>
                <Text style={styles.detailValue}>{getStatusMeta(selectedRequest.status).label}</Text>

                <Text style={styles.detailLabel}>Service</Text>
                <Text style={styles.detailValue}>
                  {selectedRequest.productName}
                  {selectedRequest.variationName ? ` (${selectedRequest.variationName})` : ""}
                </Text>

                {selectedRequest.customDesignNotes ? (
                  <>
                    <Text style={styles.detailLabel}>Custom Design Notes</Text>
                    <Text style={styles.detailValue}>{selectedRequest.customDesignNotes}</Text>
                  </>
                ) : null}

                <Text style={styles.detailLabel}>Family Coordinator</Text>
                <Text style={styles.detailValue}>{selectedRequest.familyCoordinatorName}</Text>

                <Text style={styles.detailLabel}>Contact Number</Text>
                <Text style={styles.detailValue}>{selectedRequest.contactNumber}</Text>

                <Text style={styles.detailLabel}>Wake Venue</Text>
                <Text style={styles.detailValue}>{selectedRequest.wakeAddress}</Text>

                <Text style={styles.detailLabel}>Pickup Address</Text>
                <Text style={styles.detailValue}>{selectedRequest.pickupAddress}</Text>

                <Text style={styles.detailLabel}>Shop Contact</Text>
                <Text style={styles.detailValue}>{selectedRequest.shopContactNumber || "Not available"}</Text>

                {selectedRequest.shopAddress ? (
                  <>
                    <Text style={styles.detailLabel}>Shop Address</Text>
                    <Text style={styles.detailValue}>{selectedRequest.shopAddress}</Text>
                  </>
                ) : null}

                <Text style={styles.detailLabel}>Message</Text>
                <Text style={styles.detailValue}>{selectedRequest.tributeMessage}</Text>

                <View style={styles.contactActionRow}>
                  <TouchableOpacity
                    style={[styles.contactActionButton, !selectedRequest.shopContactNumber ? styles.contactActionButtonDisabled : null]}
                    onPress={() => void openPhoneLink("call", selectedRequest.shopContactNumber)}
                    disabled={!selectedRequest.shopContactNumber}
                  >
                    <Ionicons name="call-outline" size={16} color="#171717" />
                    <Text style={styles.contactActionButtonText}>Call Shop</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.contactActionButton, !selectedRequest.shopContactNumber ? styles.contactActionButtonDisabled : null]}
                    onPress={() => void openPhoneLink("sms", selectedRequest.shopContactNumber)}
                    disabled={!selectedRequest.shopContactNumber}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#171717" />
                    <Text style={styles.contactActionButtonText}>SMS Shop</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.detailLabel}>Submitted</Text>
                <Text style={styles.detailValue}>{formatTimestamp(selectedRequest.createdAt)}</Text>

                {selectedRequest.acceptedAt ? (
                  <>
                    <Text style={styles.detailLabel}>Accepted</Text>
                    <Text style={styles.detailValue}>{formatTimestamp(selectedRequest.acceptedAt)}</Text>
                  </>
                ) : null}

                {selectedRequest.declinedAt ? (
                  <>
                    <Text style={styles.detailLabel}>Declined</Text>
                    <Text style={styles.detailValue}>{formatTimestamp(selectedRequest.declinedAt)}</Text>
                  </>
                ) : null}

                <View style={styles.statusInfoCard}>
                  <Text style={styles.statusInfoTitle}>Current Update</Text>
                  <Text style={styles.statusInfoText}>{getStatusMeta(selectedRequest.status).message}</Text>
                </View>

                <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedRequest(null)}>
                  <Text style={styles.closeButtonText}>Close</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8f7f3",
  },
  content: {
    padding: 18,
    paddingBottom: 32,
    gap: 14,
  },
  headerCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#ece7df",
    backgroundColor: "#fffaf5",
    padding: 18,
  },
  headerEyebrow: {
    color: "#a16207",
    fontSize: 12,
    fontWeight: "800",
  },
  headerTitle: {
    color: "#171717",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  headerSubtitle: {
    color: "#57534e",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 42,
  },
  loadingText: {
    color: "#57534e",
    fontSize: 13,
    marginTop: 10,
  },
  emptyCard: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ece7df",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 30,
  },
  emptyTitle: {
    color: "#171717",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 12,
  },
  emptyText: {
    color: "#57534e",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },
  requestCard: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ece7df",
    padding: 16,
  },
  requestTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  requestTextBlock: {
    flex: 1,
  },
  requestName: {
    color: "#171717",
    fontSize: 17,
    fontWeight: "900",
  },
  requestShop: {
    color: "#a16207",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  requestMeta: {
    color: "#57534e",
    fontSize: 13,
    marginTop: 8,
  },
  requestMessage: {
    lineHeight: 19,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 12, 10, 0.58)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "86%",
    borderRadius: 24,
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#ece7df",
    padding: 18,
  },
  modalTitle: {
    color: "#171717",
    fontSize: 22,
    fontWeight: "900",
  },
  modalSubtitle: {
    color: "#a16207",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
    marginBottom: 14,
  },
  modalImage: {
    width: "100%",
    height: 220,
    borderRadius: 18,
    marginBottom: 14,
  },
  modalItemImage: {
    width: "100%",
    height: 170,
    borderRadius: 18,
    marginBottom: 14,
  },
  detailLabel: {
    color: "#44403c",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 4,
  },
  detailValue: {
    color: "#171717",
    fontSize: 14,
    lineHeight: 20,
  },
  statusInfoCard: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: "#f5f5f4",
    padding: 14,
  },
  contactActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  contactActionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ece7df",
    backgroundColor: "#fffdf9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  contactActionButtonDisabled: {
    opacity: 0.45,
  },
  contactActionButtonText: {
    color: "#171717",
    fontSize: 13,
    fontWeight: "900",
  },
  statusInfoTitle: {
    color: "#171717",
    fontSize: 14,
    fontWeight: "900",
  },
  statusInfoText: {
    color: "#57534e",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  closeButton: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#f5f5f4",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  closeButtonText: {
    color: "#57534e",
    fontSize: 14,
    fontWeight: "900",
  },
});
