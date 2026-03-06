import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../services/firebaseConfig";

interface Request {
  id: string;
  patientName: string;
  hospital: string;
  bloodTypeNeeded: string;
  urgency: string;
  contactNumber: string;
  status: string;
}

export default function AvailableRequestsScreen() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const q = query(
        collection(db, "requests"),
        where("status", "==", "pending"),
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
      Alert.alert("Error", "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "Critical": return "red";
      case "Urgent": return "orange";
      default: return "green";
    }
  };

  const renderItem = ({ item }: { item: Request }) => (
    <View style={styles.card}>
      <Text style={styles.patientName}>{item.patientName}</Text>
      <Text>Hospital: {item.hospital}</Text>
      <Text>Blood Type: {item.bloodTypeNeeded}</Text>
      <Text style={{ color: getUrgencyColor(item.urgency) }}>
        Urgency: {item.urgency}
      </Text>
      <Text>Contact: {item.contactNumber}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No pending requests.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 10,
  },
  patientName: { fontSize: 18, fontWeight: "bold", marginBottom: 5 },
  empty: { textAlign: "center", marginTop: 50, fontSize: 16 },
});