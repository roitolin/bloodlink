import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { addDoc, collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from "firebase/firestore";
import { auth, db } from "@/services";

type FuneralServiceRequest = {
  id: string;
  requesterId: string;
  shopId: string;
  shopName: string;
  productId: string;
  productName: string;
  productPrice?: string;
  productImageUrl?: string | null;
  variationName?: string | null;
  requestType?: string;
  customDesignNotes?: string | null;
  memorialPhotoUrl?: string | null;
  referencePhotoUrl?: string | null;
  deceasedFullName: string;
  deceasedDateOfBirth?: string;
  deceasedAge?: number | null;
  tributeMessage: string;
  familyCoordinatorName: string;
  wakeAddress: string;
  pickupAddress: string;
  contactNumber: string;
  shopContactNumber?: string | null;
  shopAddress?: string | null;
  status: string;
  createdAt?: any;
  acceptedAt?: any;
  declinedAt?: any;
};

const getStatusMeta = (status: string) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "accepted_by_shop") {
    return { label: "Accepted", background: "#e7f5ec", text: "#166534" };
  }
  if (normalized === "declined_by_shop") {
    return { label: "Declined", background: "#fde8e8", text: "#991b1b" };
  }
  if (normalized === "cancelled_by_requester") {
    return { label: "Cancelled", background: "#eef1ec", text: "#4c5b57" };
  }
  return { label: "Waiting", background: "#fef3c7", text: "#86654a" };
};

const formatTimestamp = (value: any) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString();
};

export default function FuneralServiceRequestsInboxScreen() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<FuneralServiceRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<FuneralServiceRequest | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    setLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, "funeral_service_requests"), where("shopId", "==", user.uid)));
      const nextRequests = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }) as FuneralServiceRequest)
        .sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
      setRequests(nextRequests);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to load service requests.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
    }, [loadRequests])
  );

  const pendingCount = useMemo(
    () => requests.filter((item) => String(item.status || "").toLowerCase() === "pending_shop_acceptance").length,
    [requests]
  );

  const openPhoneLink = useCallback(async (mode: "call" | "sms", rawPhone: string | null | undefined) => {
    const phone = String(rawPhone || "").trim();
    if (!phone) {
      Alert.alert("Unavailable", mode === "call" ? "No contact number available for calling." : "No contact number available for SMS.");
      return;
    }

    try {
      await Linking.openURL(`${mode === "call" ? "tel" : "sms"}:${phone.replace(/\s+/g, "")}`);
    } catch {
      Alert.alert("Unavailable", mode === "call" ? "Call is not available on this device." : "SMS is not available on this device.");
    }
  }, []);

  const updateRequestStatus = useCallback(
    async (requestItem: FuneralServiceRequest, nextStatus: "accepted_by_shop" | "declined_by_shop") => {
      const user = auth.currentUser;
      if (!user) return;

      setUpdatingRequestId(requestItem.id);
      try {
        if (nextStatus === "accepted_by_shop" && requestItem.productId !== "custom_casket_design") {
          const userSnap = await getDoc(doc(db, "users", user.uid));
          if (userSnap.exists()) {
            const data = userSnap.data() || {};
            const funeralProducts = Array.isArray(data.funeralProducts) ? data.funeralProducts : [];
            const nextProducts = funeralProducts.map((item: any) => {
              if (String(item?.id || "") !== requestItem.productId) return item;
              const currentStock = Math.max(0, Number(item?.stock) || 0);
              return {
                ...item,
                stock: Math.max(0, currentStock - 1),
                updatedAt: new Date().toISOString(),
              };
            });

            await setDoc(
              doc(db, "users", user.uid),
              {
                funeralProducts: nextProducts,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
        }

        await updateDoc(doc(db, "funeral_service_requests", requestItem.id), {
          status: nextStatus,
          updatedAt: serverTimestamp(),
          shopRespondedAt: serverTimestamp(),
          acceptedAt: nextStatus === "accepted_by_shop" ? serverTimestamp() : null,
          declinedAt: nextStatus === "declined_by_shop" ? serverTimestamp() : null,
          handledByShopId: user.uid,
        });

        await addDoc(collection(db, "notifications"), {
          userId: requestItem.requesterId,
          type: nextStatus === "accepted_by_shop" ? "funeral_request_accepted" : "funeral_request_declined",
          title: nextStatus === "accepted_by_shop" ? "Service Request Accepted" : "Service Request Declined",
          body:
            nextStatus === "accepted_by_shop"
              ? `${requestItem.shopName} accepted your request for ${requestItem.deceasedFullName}.`
              : `${requestItem.shopName} declined your request for ${requestItem.deceasedFullName}.`,
          data: {
            requestId: requestItem.id,
            shopId: requestItem.shopId,
            requesterId: requestItem.requesterId,
          },
          read: false,
          createdAt: serverTimestamp(),
        });

        await loadRequests();
        setSelectedRequest((current) =>
          current?.id === requestItem.id ? { ...requestItem, status: nextStatus } : current
        );
        Alert.alert("Updated", nextStatus === "accepted_by_shop" ? "Request accepted." : "Request declined.");
      } catch (error: any) {
        Alert.alert("Error", error?.message || "Failed to update request.");
      } finally {
        setUpdatingRequestId(null);
      }
    },
    [loadRequests]
  );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.headerEyebrow}>Service Request Inbox</Text>
            <Text style={styles.headerTitle}>Family Requests</Text>
            <Text style={styles.headerSubtitle}>Review incoming requests and respond so families know your next step.</Text>
          </View>
          <View style={styles.pendingPill}>
            <Text style={styles.pendingPillLabel}>Waiting</Text>
            <Text style={styles.pendingPillValue}>{pendingCount}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.refreshButton} onPress={() => void loadRequests()}>
          <Ionicons name="refresh-outline" size={16} color="#22312d" />
          <Text style={styles.refreshButtonText}>Refresh Requests</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#86654a" />
            <Text style={styles.loadingText}>Loading service requests...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="mail-open-outline" size={28} color="#8b938c" />
            <Text style={styles.emptyTitle}>No service requests yet</Text>
            <Text style={styles.emptyText}>When a family sends a request, it will appear here for review.</Text>
          </View>
        ) : (
          requests.map((item) => {
            const statusMeta = getStatusMeta(item.status);

            return (
              <TouchableOpacity key={item.id} style={styles.requestCard} activeOpacity={0.92} onPress={() => setSelectedRequest(item)}>
                <View style={styles.requestTopRow}>
                  <View style={styles.requestTextBlock}>
                    <Text style={styles.requestName}>{item.deceasedFullName}</Text>
                    <Text style={styles.requestProduct}>{item.productName}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusMeta.background }]}>
                    <Text style={[styles.statusBadgeText, { color: statusMeta.text }]}>{statusMeta.label}</Text>
                  </View>
                </View>

                <Text style={styles.requestMeta}>Coordinator: {item.familyCoordinatorName}</Text>
                <Text style={styles.requestMeta}>Contact: {item.contactNumber}</Text>
                <Text style={styles.requestMeta}>Sent: {formatTimestamp(item.createdAt)}</Text>
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
                <Text style={styles.modalSubtitle}>{selectedRequest.requestType === "custom_casket" ? "Custom Casket Request" : selectedRequest.productName}</Text>
                {selectedRequest.productImageUrl ? (
                  <Image source={{ uri: selectedRequest.productImageUrl }} style={styles.modalItemImage} resizeMode="cover" />
                ) : null}
                {selectedRequest.memorialPhotoUrl ? (
                  <Image source={{ uri: selectedRequest.memorialPhotoUrl }} style={styles.modalImage} resizeMode="cover" />
                ) : null}

                <Text style={styles.detailLabel}>Requested Item</Text>
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

                <Text style={styles.detailLabel}>Age</Text>
                <Text style={styles.detailValue}>{selectedRequest.deceasedAge ?? "Not provided"}</Text>

                <Text style={styles.detailLabel}>Wake Venue</Text>
                <Text style={styles.detailValue}>{selectedRequest.wakeAddress}</Text>

                <Text style={styles.detailLabel}>Pickup Address</Text>
                <Text style={styles.detailValue}>{selectedRequest.pickupAddress}</Text>

                <Text style={styles.detailLabel}>Tribute Message</Text>
                <Text style={styles.detailValue}>{selectedRequest.tributeMessage}</Text>

                <View style={styles.contactActionRow}>
                  <TouchableOpacity style={styles.contactActionButton} onPress={() => void openPhoneLink("call", selectedRequest.contactNumber)}>
                    <Ionicons name="call-outline" size={16} color="#22312d" />
                    <Text style={styles.contactActionButtonText}>Call</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.contactActionButton} onPress={() => void openPhoneLink("sms", selectedRequest.contactNumber)}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#22312d" />
                    <Text style={styles.contactActionButtonText}>SMS</Text>
                  </TouchableOpacity>
                </View>

                {String(selectedRequest.status || "").toLowerCase() === "pending_shop_acceptance" ? (
                  <View style={styles.actionStack}>
                    <TouchableOpacity
                      style={[styles.acceptButton, updatingRequestId === selectedRequest.id ? styles.buttonDisabled : null]}
                      onPress={() => void updateRequestStatus(selectedRequest, "accepted_by_shop")}
                      disabled={updatingRequestId === selectedRequest.id}
                    >
                      <Text style={styles.acceptButtonText}>{updatingRequestId === selectedRequest.id ? "Updating..." : "Accept Request"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.declineButton, updatingRequestId === selectedRequest.id ? styles.buttonDisabled : null]}
                      onPress={() => void updateRequestStatus(selectedRequest, "declined_by_shop")}
                      disabled={updatingRequestId === selectedRequest.id}
                    >
                      <Text style={styles.declineButtonText}>Decline Request</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.readonlyStatusCard}>
                    <Text style={styles.readonlyStatusTitle}>Response Recorded</Text>
                    <Text style={styles.readonlyStatusText}>
                      This request has already been {getStatusMeta(selectedRequest.status).label.toLowerCase()}.
                    </Text>
                  </View>
                )}

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
    backgroundColor: "#eef1ec",
  },
  content: {
    padding: 18,
    paddingBottom: 32,
    gap: 14,
  },
  headerCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#d9d6cd",
    backgroundColor: "#f8f6f2",
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  headerEyebrow: {
    color: "#8b7255",
    fontSize: 12,
    fontWeight: "800",
  },
  headerTitle: {
    color: "#22312d",
    fontSize: 24,
    fontWeight: "900",
    marginTop: 4,
  },
  headerSubtitle: {
    color: "#62706b",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 240,
  },
  pendingPill: {
    minWidth: 82,
    borderRadius: 20,
    backgroundColor: "#22312d",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pendingPillLabel: {
    color: "#d2d7d1",
    fontSize: 11,
    fontWeight: "700",
  },
  pendingPillValue: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "900",
  },
  refreshButton: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9d6cd",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  refreshButtonText: {
    color: "#22312d",
    fontSize: 13,
    fontWeight: "900",
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 42,
  },
  loadingText: {
    color: "#62706b",
    fontSize: 13,
    marginTop: 10,
  },
  emptyCard: {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9d6cd",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 30,
  },
  emptyTitle: {
    color: "#22312d",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 12,
  },
  emptyText: {
    color: "#62706b",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 6,
  },
  requestCard: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d9d6cd",
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
    color: "#22312d",
    fontSize: 17,
    fontWeight: "900",
  },
  requestProduct: {
    color: "#8b7255",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  requestMeta: {
    color: "#62706b",
    fontSize: 13,
    marginTop: 8,
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
    backgroundColor: "#f8f6f2",
    borderWidth: 1,
    borderColor: "#d9d6cd",
    padding: 18,
  },
  modalTitle: {
    color: "#22312d",
    fontSize: 22,
    fontWeight: "900",
  },
  modalSubtitle: {
    color: "#8b7255",
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
    color: "#53615d",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 4,
  },
  detailValue: {
    color: "#22312d",
    fontSize: 14,
    lineHeight: 20,
  },
  actionStack: {
    gap: 10,
    marginTop: 18,
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
    borderColor: "#d9d6cd",
    backgroundColor: "#fbfaf7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  contactActionButtonText: {
    color: "#22312d",
    fontSize: 13,
    fontWeight: "900",
  },
  acceptButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#22312d",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  declineButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
    justifyContent: "center",
  },
  declineButtonText: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  readonlyStatusCard: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: "#ece9e3",
    padding: 14,
  },
  readonlyStatusTitle: {
    color: "#22312d",
    fontSize: 14,
    fontWeight: "900",
  },
  readonlyStatusText: {
    color: "#62706b",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  closeButton: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#ece9e3",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  closeButtonText: {
    color: "#62706b",
    fontSize: 14,
    fontWeight: "900",
  },
});
