import { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { Card, Chip, Text } from "react-native-paper";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";

type DonationHistoryItem = {
  id: string;
  donorId: string;
  requesterId: string;
  requestId?: string;
  patientName?: string;
  hospital?: string;
  city?: string;
  bloodType?: string;
  urgency?: string;
  donatedAt?: any;
  certificateId?: string;
};

export default function DonationHistoryScreen() {
  const { isDesktop } = useResponsive();
  const [records, setRecords] = useState<DonationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const userId = auth.currentUser?.uid;

  const loadHistory = useCallback(async () => {
    if (!userId) {
      setRecords([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [asDonorSnap, asRequesterSnap] = await Promise.all([
        getDocs(query(collection(db, "donation_history"), where("donorId", "==", userId))),
        getDocs(query(collection(db, "donation_history"), where("requesterId", "==", userId))),
      ]);

      const mergedMap = new Map<string, DonationHistoryItem>();

      asDonorSnap.docs.forEach((item) => {
        mergedMap.set(item.id, { id: item.id, ...(item.data() as any) });
      });
      asRequesterSnap.docs.forEach((item) => {
        mergedMap.set(item.id, { id: item.id, ...(item.data() as any) });
      });

      const sorted = Array.from(mergedMap.values()).sort((a, b) => {
        const aTime = a.donatedAt?.toDate?.()?.getTime?.() || 0;
        const bTime = b.donatedAt?.toDate?.()?.getTime?.() || 0;
        return bTime - aTime;
      });

      setRecords(sorted);
    } catch (error) {
      console.error("Failed to load donation history:", error);
      Alert.alert("Error", "Could not load donation history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const renderItem = ({ item }: { item: DonationHistoryItem }) => {
    const participatedAs = item.donorId === userId ? "Donor" : "Requester";
    const donatedAtText = item.donatedAt?.toDate ? item.donatedAt.toDate().toLocaleString() : "Unknown date";

    return (
      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <View style={styles.topRow}>
            <Text style={styles.title}>Donation Completed</Text>
            <Chip compact>{participatedAs}</Chip>
          </View>
          <Text style={styles.meta}>Patient: {item.patientName || "Unknown"}</Text>
          <Text style={styles.meta}>Hospital: {item.hospital || "Unknown"}</Text>
          <Text style={styles.meta}>Location: {item.city || "Unknown City"}</Text>
          <Text style={styles.meta}>Blood Type: {item.bloodType || "N/A"}</Text>
          <Text style={styles.meta}>Urgency: {item.urgency || "N/A"}</Text>
          <Text style={styles.date}>Completed: {donatedAtText}</Text>
          <View style={styles.certificateWrap}>
            <Text style={styles.certificateLabel}>Certificate ID</Text>
            <Text style={styles.certificateValue}>{item.certificateId || `BL-CERT-${item.id.slice(0, 8).toUpperCase()}`}</Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <Card style={styles.headerCard} mode="elevated">
        <Card.Content>
          <Text style={styles.headerTitle}>Donation Timeline & Certificates</Text>
          <Text style={styles.headerSubtitle}>
            Keep a record of all successful donations and your generated certificate IDs.
          </Text>
        </Card.Content>
      </Card>

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No donation history yet</Text>
              <Text style={styles.emptySubtitle}>
                Once a request is marked completed, it will appear here with certificate details.
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f3f4f6",
  },
  containerDesktop: {
    maxWidth: 980,
    alignSelf: "center",
    width: "100%",
  },
  headerCard: {
    borderRadius: 12,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#b91c1c",
  },
  headerSubtitle: {
    marginTop: 4,
    color: "#4b5563",
  },
  listContent: {
    paddingBottom: 30,
    flexGrow: 1,
  },
  card: {
    borderRadius: 12,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  meta: {
    color: "#374151",
    marginTop: 2,
  },
  date: {
    marginTop: 6,
    color: "#6b7280",
    fontWeight: "600",
  },
  certificateWrap: {
    marginTop: 8,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  certificateLabel: {
    fontSize: 12,
    color: "#92400e",
    fontWeight: "700",
  },
  certificateValue: {
    marginTop: 2,
    color: "#78350f",
    fontWeight: "800",
  },
  emptyCard: {
    marginTop: 22,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    padding: 16,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 17,
  },
  emptySubtitle: {
    marginTop: 4,
    color: "#6b7280",
    textAlign: "center",
  },
});

