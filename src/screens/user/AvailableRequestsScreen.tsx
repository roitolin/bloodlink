import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { getRequestSlaState } from "../../utils/requestSla";
import { getRequestLocationText } from "../../utils/privacy";

interface Request {
  id: string;
  patientName: string;
  hospital: string;
  city?: string;
  bloodTypeNeeded: string;
  urgency: string;
  contactNumber: string;
  status: string;
  createdAt?: any;
  slaDeadlineAt?: any;
}

export default function AvailableRequestsScreen({ navigation }: any) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const { isDesktop } = useResponsive();

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
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
      case "Critical":
        return "red";
      case "Urgent":
        return "orange";
      default:
        return "green";
    }
  };

  const renderItem = ({ item }: { item: Request }) => {
    const slaState = getRequestSlaState(item, now);
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("RequestDetail", { requestId: item.id })}
      >
        <Text style={styles.cardTitle}>Blood Request</Text>
        <Text style={styles.patientName}>{item.patientName}</Text>
        <Text>Hospital: {item.hospital}</Text>
        <Text>Location: {getRequestLocationText(item, false)}</Text>
        <Text style={styles.privacyHint}>Detailed address is hidden until request acceptance.</Text>
        <Text>Blood Type: {item.bloodTypeNeeded}</Text>
        <Text style={{ color: getUrgencyColor(item.urgency) }}>Urgency: {item.urgency}</Text>
        <Text
          style={[
            styles.slaText,
            slaState.tone === "danger" && styles.slaTextDanger,
            slaState.tone === "warning" && styles.slaTextWarning,
          ]}
        >
          Response Time: {slaState.label}
        </Text>
        <Text>Contact: {item.contactNumber}</Text>
      </TouchableOpacity>
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
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No pending requests.</Text>}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", marginTop: 50, fontSize: 16 },
  listContent: { paddingTop: 10, paddingBottom: 12 },
  card: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: "bold", color: "#d32f2f", marginBottom: 5 },
  patientName: { fontSize: 18, fontWeight: "bold" },
  privacyHint: { color: "#92400e", fontSize: 12, marginTop: 2, fontWeight: "600" },
  slaText: {
    fontWeight: "700",
    marginTop: 2,
    color: "#15803d",
  },
  slaTextWarning: {
    color: "#b45309",
  },
  slaTextDanger: {
    color: "#b91c1c",
  },
  containerDesktop: {
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
  },
});


