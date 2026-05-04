import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
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
  updatedAt?: any;
  acceptedAt?: any;
  declinedAt?: any;
  cancelledAt?: any;
};

type RequestEditForm = {
  deceasedFullName: string;
  tributeMessage: string;
  familyCoordinatorName: string;
  wakeAddress: string;
  pickupAddress: string;
  contactNumber: string;
};

const isPendingRequest = (status: string) => String(status || "").toLowerCase() === "pending_shop_acceptance";

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
  if (normalized === "cancelled_by_requester") {
    return {
      label: "Cancelled",
      background: "#eef1ec",
      text: "#4c5b57",
      message: "You cancelled this request before the shop accepted it.",
    };
  }
  return {
    label: "Waiting for Shop",
    background: "#fef3c7",
    text: "#86654a",
    message: "Your request has been sent. Please wait while the shop reviews it.",
  };
};

const formatTimestamp = (value: any) => {
  const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString();
};

const buildEditForm = (request: FuneralServiceRequest): RequestEditForm => ({
  deceasedFullName: String(request.deceasedFullName || ""),
  tributeMessage: String(request.tributeMessage || ""),
  familyCoordinatorName: String(request.familyCoordinatorName || ""),
  wakeAddress: String(request.wakeAddress || ""),
  pickupAddress: String(request.pickupAddress || ""),
  contactNumber: String(request.contactNumber || ""),
});

export default function FuneralMyServiceRequestsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<FuneralServiceRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<FuneralServiceRequest | null>(null);
  const [editingRequest, setEditingRequest] = useState<FuneralServiceRequest | null>(null);
  const [editForm, setEditForm] = useState<RequestEditForm>({
    deceasedFullName: "",
    tributeMessage: "",
    familyCoordinatorName: "",
    wakeAddress: "",
    pickupAddress: "",
    contactNumber: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [cancellingRequestId, setCancellingRequestId] = useState<string | null>(null);

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
      setSelectedRequest((current) => nextRequests.find((item) => item.id === current?.id) || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
    }, [loadRequests])
  );

  const openEditRequest = useCallback((request: FuneralServiceRequest) => {
    setEditingRequest(request);
    setEditForm(buildEditForm(request));
  }, []);

  const closeEditRequest = useCallback(() => {
    if (savingEdit) return;
    setEditingRequest(null);
  }, [savingEdit]);

  const saveRequestEdits = useCallback(async () => {
    if (!editingRequest) return;

    const safeDeceasedFullName = editForm.deceasedFullName.trim();
    const safeTributeMessage = editForm.tributeMessage.trim();
    const safeFamilyCoordinatorName = editForm.familyCoordinatorName.trim();
    const safeWakeAddress = editForm.wakeAddress.trim();
    const safePickupAddress = editForm.pickupAddress.trim();
    const safeContactNumber = editForm.contactNumber.trim();

    if (
      !safeDeceasedFullName ||
      !safeTributeMessage ||
      !safeFamilyCoordinatorName ||
      !safeWakeAddress ||
      !safePickupAddress ||
      !safeContactNumber
    ) {
      Alert.alert("Incomplete", "Please complete all required request fields before saving.");
      return;
    }

    setSavingEdit(true);
    try {
      await updateDoc(doc(db, "funeral_service_requests", editingRequest.id), {
        deceasedFullName: safeDeceasedFullName,
        tributeMessage: safeTributeMessage,
        familyCoordinatorName: safeFamilyCoordinatorName,
        wakeAddress: safeWakeAddress,
        pickupAddress: safePickupAddress,
        contactNumber: safeContactNumber,
        updatedAt: serverTimestamp(),
      });

      await loadRequests();
      setSelectedRequest((current) =>
        current?.id === editingRequest.id
          ? {
              ...current,
              deceasedFullName: safeDeceasedFullName,
              tributeMessage: safeTributeMessage,
              familyCoordinatorName: safeFamilyCoordinatorName,
              wakeAddress: safeWakeAddress,
              pickupAddress: safePickupAddress,
              contactNumber: safeContactNumber,
            }
          : current
      );
      setEditingRequest(null);
      Alert.alert("Saved", "Your request details were updated.");
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to update your request.");
    } finally {
      setSavingEdit(false);
    }
  }, [editForm, editingRequest, loadRequests]);

  const cancelRequest = useCallback(
    async (request: FuneralServiceRequest) => {
      if (!isPendingRequest(request.status)) {
        Alert.alert("Unavailable", "Only requests that are still waiting for shop acceptance can be cancelled.");
        return;
      }

      Alert.alert("Cancel Request", "Cancel this request before the shop accepts it?", [
        { text: "Keep Request", style: "cancel" },
        {
          text: "Cancel Request",
          style: "destructive",
          onPress: async () => {
            setCancellingRequestId(request.id);
            try {
              await updateDoc(doc(db, "funeral_service_requests", request.id), {
                status: "cancelled_by_requester",
                cancelledAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
              await loadRequests();
              setSelectedRequest((current) =>
                current?.id === request.id
                  ? {
                      ...current,
                      status: "cancelled_by_requester",
                    }
                  : current
              );
              Alert.alert("Cancelled", "Your request has been cancelled.");
            } catch (error: any) {
              Alert.alert("Error", error?.message || "Failed to cancel your request.");
            } finally {
              setCancellingRequestId(null);
            }
          },
        },
      ]);
    },
    [loadRequests]
  );

  const handleBackToProfile = useCallback(() => {
    if (navigation?.canGoBack?.()) {
      navigation.goBack();
      return;
    }

    navigation?.navigate?.("ProfileMain");
  }, [navigation]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.88} onPress={handleBackToProfile}>
            <Ionicons name="arrow-back" size={18} color="#22312d" />
            <Text style={styles.backButtonText}>Back to Profile</Text>
          </TouchableOpacity>
          <Text style={styles.headerEyebrow}>My Service Requests</Text>
          <Text style={styles.headerTitle}>Request Tracker</Text>
          <Text style={styles.headerSubtitle}>Monitor your submitted arrangements and wait for the shop&apos;s response here.</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#86654a" />
            <Text style={styles.loadingText}>Loading your requests...</Text>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={28} color="#8b938c" />
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
                    <Ionicons name="call-outline" size={16} color="#22312d" />
                    <Text style={styles.contactActionButtonText}>Call Shop</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.contactActionButton, !selectedRequest.shopContactNumber ? styles.contactActionButtonDisabled : null]}
                    onPress={() => void openPhoneLink("sms", selectedRequest.shopContactNumber)}
                    disabled={!selectedRequest.shopContactNumber}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#22312d" />
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

                {selectedRequest.cancelledAt ? (
                  <>
                    <Text style={styles.detailLabel}>Cancelled</Text>
                    <Text style={styles.detailValue}>{formatTimestamp(selectedRequest.cancelledAt)}</Text>
                  </>
                ) : null}

                {isPendingRequest(selectedRequest.status) ? (
                  <View style={styles.actionStack}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => openEditRequest(selectedRequest)}
                    >
                      <Text style={styles.editButtonText}>Edit Request</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.cancelButton, cancellingRequestId === selectedRequest.id ? styles.buttonDisabled : null]}
                      onPress={() => void cancelRequest(selectedRequest)}
                      disabled={cancellingRequestId === selectedRequest.id}
                    >
                      <Text style={styles.cancelButtonText}>{cancellingRequestId === selectedRequest.id ? "Cancelling..." : "Cancel Request"}</Text>
                    </TouchableOpacity>
                  </View>
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

      <Modal visible={Boolean(editingRequest)} transparent animationType="fade" onRequestClose={closeEditRequest}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeEditRequest}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            {editingRequest ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Edit Request</Text>
                <Text style={styles.modalCaption}>You can update this request while the shop has not accepted it yet.</Text>

                <Text style={styles.inputLabel}>Deceased Full Name</Text>
                <TextInput style={styles.input} value={editForm.deceasedFullName} onChangeText={(value) => setEditForm((current) => ({ ...current, deceasedFullName: value }))} />

                <Text style={styles.inputLabel}>Family Coordinator</Text>
                <TextInput style={styles.input} value={editForm.familyCoordinatorName} onChangeText={(value) => setEditForm((current) => ({ ...current, familyCoordinatorName: value }))} />

                <Text style={styles.inputLabel}>Contact Number</Text>
                <TextInput
                  style={styles.input}
                  value={editForm.contactNumber}
                  onChangeText={(value) => setEditForm((current) => ({ ...current, contactNumber: value }))}
                  keyboardType="phone-pad"
                />

                <Text style={styles.inputLabel}>Wake Venue</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={editForm.wakeAddress}
                  onChangeText={(value) => setEditForm((current) => ({ ...current, wakeAddress: value }))}
                  multiline
                />

                <Text style={styles.inputLabel}>Pickup Address</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={editForm.pickupAddress}
                  onChangeText={(value) => setEditForm((current) => ({ ...current, pickupAddress: value }))}
                  multiline
                />

                <Text style={styles.inputLabel}>Message</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={editForm.tributeMessage}
                  onChangeText={(value) => setEditForm((current) => ({ ...current, tributeMessage: value }))}
                  multiline
                />

                <View style={styles.actionStack}>
                  <TouchableOpacity style={[styles.editButton, savingEdit ? styles.buttonDisabled : null]} onPress={() => void saveRequestEdits()} disabled={savingEdit}>
                    <Text style={styles.editButtonText}>{savingEdit ? "Saving..." : "Save Changes"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.closeButton} onPress={closeEditRequest} disabled={savingEdit}>
                    <Text style={styles.closeButtonText}>Close</Text>
                  </TouchableOpacity>
                </View>
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
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d9d6cd",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  backButtonText: {
    color: "#22312d",
    fontSize: 13,
    fontWeight: "800",
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
  requestShop: {
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
  modalCaption: {
    color: "#62706b",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
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
  inputLabel: {
    color: "#53615d",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d2d7d1",
    backgroundColor: "#fcfcfb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#22312d",
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  statusInfoCard: {
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: "#ece9e3",
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
    borderColor: "#d9d6cd",
    backgroundColor: "#fbfaf7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  contactActionButtonDisabled: {
    opacity: 0.45,
  },
  contactActionButtonText: {
    color: "#22312d",
    fontSize: 13,
    fontWeight: "900",
  },
  actionStack: {
    gap: 10,
    marginTop: 16,
  },
  editButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#22312d",
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  cancelButton: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "#991b1b",
    fontSize: 14,
    fontWeight: "900",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statusInfoTitle: {
    color: "#22312d",
    fontSize: 14,
    fontWeight: "900",
  },
  statusInfoText: {
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
