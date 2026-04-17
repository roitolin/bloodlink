import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
  TouchableOpacity,
  Linking,
} from "react-native";
import { Button, useTheme } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";

type PendingUser = {
  id: string;
  email: string;
  fullName?: string;
  bloodType?: string;
  city?: string;
  street?: string;
  medicalCertificateURL?: string;
  donorVerificationRequestedAt?: any;
};

export default function AdminDonorVerificationsScreen() {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<PendingUser | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const { isDesktop } = useResponsive();
  const theme = useTheme();

  useEffect(() => {
    loadPending();
  }, []);

  const loadPending = async () => {
    try {
      const q = query(collection(db, "users"), where("donorStatus", "==", "pending"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as PendingUser[];
      setPendingUsers(list);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load pending verifications.");
    } finally {
      setLoading(false);
    }
  };

  const approve = async (userId: string) => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "users", userId), {
        donorStatus: "verified",
        donorVerificationRejectionReason: null,
      });
      await addDoc(collection(db, "notifications"), {
        userId,
        type: "donor_approved",
        title: "Donor Verification Approved",
        body: "Your donor verification has been approved! You can now set yourself as available.",
        read: false,
        createdAt: serverTimestamp(),
      });
      Alert.alert("Success", "Donor approved.");
      loadPending();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setActionLoading(false);
      setModalVisible(false);
    }
  };

  const reject = async (userId: string) => {
    if (!rejectionReason.trim()) {
      Alert.alert("Error", "Please provide a reason.");
      return;
    }
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "users", userId), {
        donorStatus: "rejected",
        donorVerificationRejectionReason: rejectionReason,
      });
      await addDoc(collection(db, "notifications"), {
        userId,
        type: "donor_rejected",
        title: "Donor Verification Rejected",
        body: `Your donor verification was rejected. Reason: ${rejectionReason}`,
        read: false,
        createdAt: serverTimestamp(),
      });
      Alert.alert("Success", "Donor rejected.");
      setRejectionReason("");
      loadPending();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setActionLoading(false);
      setModalVisible(false);
    }
  };

  const renderItem = ({ item }: { item: PendingUser }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        setSelectedUser(item);
        setModalVisible(true);
      }}
    >
      <Text style={styles.name}>{item.fullName || "Anonymous"}</Text>
      <Text>Email: {item.email}</Text>
      <Text>Blood Type: {item.bloodType}</Text>
      <Text>Location: {item.city || "N/A"}</Text>
      <Text>
        Requested:{" "}
        {item.donorVerificationRequestedAt?.toDate().toLocaleString()}
      </Text>
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
      <Text style={styles.title}>Pending Donor Verifications</Text>
      <FlatList
        data={pendingUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No pending requests.</Text>}
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Review Donor</Text>
            {selectedUser && (
              <>
                <Text style={styles.label}>Name: {selectedUser.fullName}</Text>
                <Text>Email: {selectedUser.email}</Text>
                <Text>Blood Type: {selectedUser.bloodType}</Text>
                <Text>Location: {selectedUser.city || "N/A"}</Text>
                <Text>Street: {selectedUser.street || "N/A"}</Text>
                <Text>Certificate:</Text>
                {selectedUser.medicalCertificateURL ? (
                  <TouchableOpacity
                    onPress={() => Linking.openURL(selectedUser.medicalCertificateURL!)}
                    style={styles.certLink}
                  >
                    <Ionicons name="document-text" size={24} color={theme.colors.primary} />
                    <Text style={[styles.certText, { color: theme.colors.primary }]}>
                      View Certificate
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <Text>No certificate uploaded</Text>
                )}
                <TextInput
                  placeholder="Rejection reason (if rejecting)"
                  value={rejectionReason}
                  onChangeText={setRejectionReason}
                  style={styles.reasonInput}
                  multiline
                />
                <View style={styles.modalButtons}>
                  <Button
                    mode="contained"
                    onPress={() => approve(selectedUser.id)}
                    loading={actionLoading}
                    disabled={actionLoading}
                  >
                    Approve
                  </Button>
                  <Button
                    mode="contained"
                    onPress={() => reject(selectedUser.id)}
                    loading={actionLoading}
                    disabled={actionLoading}
                    buttonColor="red"
                  >
                    Reject
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      setModalVisible(false);
                      setRejectionReason("");
                    }}
                  >
                    Cancel
                  </Button>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20, color: "#d32f2f" },
  card: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  name: { fontSize: 18, fontWeight: "bold", marginBottom: 5 },
  empty: { textAlign: "center", marginTop: 50, fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxWidth: 500,
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  label: { fontSize: 16, fontWeight: "600", marginTop: 10 },
  certLink: { flexDirection: "row", alignItems: "center", marginVertical: 10 },
  certText: { marginLeft: 8, fontSize: 16 },
  reasonInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginVertical: 10,
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
    gap: 10,
  },
  containerDesktop: { maxWidth: 800, alignSelf: "center", width: "100%" },
});

