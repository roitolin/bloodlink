import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { Avatar, Card, Title, Divider, Button } from "react-native-paper";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { getDefaultProfileImage } from "../../utils/defaultProfileImage";
import { getConversationId } from "../../utils/chatHelpers";

type User = {
  id: string;
  email: string;
  fullName?: string;
  role?: string;
  disabled?: boolean;
  createdAt?: any;
  photoURL?: string;
  gender?: string;
  dateOfBirth?: string;
  contactNumber?: string;
  bloodType?: string;
  city?: string;
  street?: string;
  donorStatus?: string;
  availabilityStatus?: string;
  medicalCertificateURL?: string;
};

type Request = {
  id: string;
  patientName: string;
  hospital: string;
  bloodTypeNeeded: string;
  urgency: string;
  status: string;
  createdAt: any;
};

export default function AdminUserDetailScreen({ route, navigation }: any) {
  const { userId } = route.params;
  const fromChatConversation = Boolean(route.params?.fromChatConversation);
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const { isDesktop } = useResponsive();

  const loadUserAndRequests = useCallback(async () => {
    try {
      const userDoc = await getDoc(doc(db, "users", userId));
      if (userDoc.exists()) {
        setUser({ id: userDoc.id, ...userDoc.data() } as User);
      } else {
        Alert.alert("Error", "User not found.");
        navigation.goBack();
        return;
      }

      // Fetch user's requests
      const q = query(
        collection(db, "requests"),
        where("requesterId", "==", userId),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Request[];
      setRequests(list);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load user details.");
    } finally {
      setLoading(false);
    }
  }, [navigation, userId]);

  useEffect(() => {
    loadUserAndRequests();
  }, [loadUserAndRequests]);

  const callUser = () => {
    if (user?.contactNumber) {
      Linking.openURL(`tel:${user.contactNumber}`);
    } else {
      Alert.alert("No contact number", "This user has not provided a contact number.");
    }
  };

  const smsUser = () => {
    if (user?.contactNumber) {
      Linking.openURL(`sms:${user.contactNumber}`);
    } else {
      Alert.alert("No contact number", "This user has not provided a contact number.");
    }
  };

  const openCertificate = async () => {
    if (!user?.medicalCertificateURL) {
      Alert.alert("No certificate", "This user has not uploaded a medical certificate.");
      return;
    }
    try {
      await Linking.openURL(user.medicalCertificateURL);
    } catch {
      Alert.alert("Error", "Unable to open certificate.");
    }
  };

  const startConversation = async () => {
    if (!user) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert("Error", "You must be logged in.");
      return;
    }

    const conversationId = getConversationId(currentUser.uid, user.id);
    const convRef = doc(db, "conversations", conversationId);
    const convSnap = await getDoc(convRef);
    if (!convSnap.exists()) {
      await setDoc(convRef, {
        participants: [currentUser.uid, user.id],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    navigation.navigate("Chat", {
      conversationId,
      otherUserId: user.id,
    });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    return timestamp.toDate().toLocaleDateString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "orange";
      case "accepted": return "green";
      case "completed": return "blue";
      default: return "gray";
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) return null;

  const isDonor = !!user.bloodType;
  const donorStatusText = user.donorStatus === "verified" ? "✅ Verified" : user.donorStatus === "pending" ? "⏳ Pending" : user.donorStatus === "rejected" ? "❌ Rejected" : "Not a donor";

  return (
    <ScrollView contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
      {/* Profile Header */}
      <View style={styles.header}>
        {user.photoURL ? (
          <Avatar.Image size={100} source={{ uri: user.photoURL }} />
        ) : (
          <Avatar.Image size={100} source={getDefaultProfileImage(user.gender as any)} />
        )}
        <Title style={styles.name}>{user.fullName || "No name"}</Title>
        <Text style={styles.email}>{user.email}</Text>
        <Text selectable style={styles.uid}>UID: {user.id}</Text>
        <Text style={styles.role}>Role: {user.role || "user"}</Text>
        <Text style={styles.status}>
          Status: {user.disabled ? "Disabled" : "Active"}
        </Text>
      </View>

      <Divider />

      {/* Personal Information */}
      <Card style={styles.card}>
        <Card.Title title="Personal Information" />
        <Card.Content>
          <Text>Gender: {user.gender || "Not specified"}</Text>
          <Text>Date of Birth: {user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : "N/A"}</Text>
          <Text>Contact: {user.contactNumber || "Not provided"}</Text>
          <Text>Created: {formatDate(user.createdAt)}</Text>
        </Card.Content>
      </Card>

      {/* Donor Information */}
      <Card style={styles.card}>
        <Card.Title title="Donor Information" />
        <Card.Content>
          <Text>Donor Status: {donorStatusText}</Text>
          {isDonor ? (
            <>
              <Text>Blood Type: {user.bloodType}</Text>
              <Text>Location: {user.street ? `${user.street}, ` : ""}{user.city || "N/A"}</Text>
              <Text>Availability: {user.availabilityStatus === "available" ? "Available" : "Not Available"}</Text>
              {user.medicalCertificateURL ? (
                <Button mode="outlined" onPress={openCertificate} style={{ marginTop: 8 }}>
                  View Medical Certificate
                </Button>
              ) : (
                <Text>Certificate: Not uploaded</Text>
              )}
            </>
          ) : (
            <>
              <Text>This user is not a donor.</Text>
              {user.medicalCertificateURL ? (
                <Button mode="outlined" onPress={openCertificate} style={{ marginTop: 8 }}>
                  View Medical Certificate
                </Button>
              ) : null}
            </>
          )}
        </Card.Content>
      </Card>

      {/* User's Requests */}
      <Card style={styles.card}>
        <Card.Title title="Blood Requests" />
        <Card.Content>
          {requests.length === 0 ? (
            <Text>No requests found.</Text>
          ) : (
            requests.map((req) => (
              <View key={req.id} style={styles.requestItem}>
                <Text style={styles.patientName}>{req.patientName}</Text>
                <Text>Request ID: {req.id}</Text>
                <Text>Hospital: {req.hospital}</Text>
                <Text>Blood Type: {req.bloodTypeNeeded}</Text>
                <Text>Urgency: {req.urgency}</Text>
                <Text style={{ color: getStatusColor(req.status) }}>
                  Status: {req.status.toUpperCase()}
                </Text>
                <Text style={styles.date}>Posted: {formatDate(req.createdAt)}</Text>
                <Divider style={{ marginVertical: 8 }} />
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      {/* Action Buttons */}
      <View style={styles.buttonGroup}>
        <Button mode="contained" buttonColor="#b91c1c" onPress={callUser} style={styles.actionButton} icon="phone">
          Call
        </Button>
        <Button mode="contained" buttonColor="#b91c1c" onPress={smsUser} style={styles.actionButton} icon="message-text">
          SMS
        </Button>
        {!fromChatConversation && (
          <Button mode="contained" buttonColor="#7f1d1d" onPress={startConversation} style={styles.actionButton} icon="chat">
            Chat
          </Button>
        )}
      </View>

      <Button mode="outlined" onPress={() => navigation.goBack()} style={styles.backButton}>
        Back
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { alignItems: "center", marginBottom: 20 },
  name: { fontSize: 24, marginTop: 12 },
  email: { fontSize: 16, color: "#666", marginTop: 4 },
  uid: { fontSize: 12, color: "#4f46e5", fontWeight: "700", marginTop: 3 },
  role: { fontSize: 14, color: "#888", marginTop: 2 },
  status: { fontSize: 14, color: "#d32f2f", marginTop: 2 },
  card: { marginBottom: 16 },
  requestItem: { marginBottom: 8 },
  patientName: { fontSize: 16, fontWeight: "bold" },
  date: { fontSize: 12, color: "#888", marginTop: 4 },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
    marginBottom: 8,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  backButton: { marginTop: 8 },
  containerDesktop: { maxWidth: 800, alignSelf: "center", width: "100%" },
});

