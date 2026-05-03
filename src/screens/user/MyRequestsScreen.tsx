import { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Pressable,
} from "react-native";
import { Button } from "react-native-paper";
import { collection, deleteDoc, doc, getDocs, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { getRequestSlaState } from "../../utils/requestSla";
import { syncPublicCityAvailability } from "../../utils/publicCityAvailability";

interface Request {
  id: string;
  patientName: string;
  hospital: string;
  city?: string;
  bloodTypeNeeded: string;
  urgency: string;
  status: string;
  contactNumber?: string;
  location?: { latitude?: number; longitude?: number } | null;
  locationLabel?: string | null;
  createdAt: any;
  acceptedAt?: any;
  completedAt?: any;
}

export default function MyRequestsScreen({ navigation, route }: any) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [highlightRequestId, setHighlightRequestId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const routeParams = route?.params || null;
  const justCreated = Boolean(routeParams?.justCreated);
  const justUpdated = Boolean(routeParams?.justUpdated);
  const { isDesktop } = useResponsive();
  const pendingCount = requests.filter((item) => item.status === "pending").length;
  const acceptedCount = requests.filter((item) => item.status === "accepted").length;
  const completedCount = requests.filter((item) => item.status === "completed").length;
  const breachedCount = requests.filter((item) => {
    if (item.status !== "pending") return false;
    return getRequestSlaState(item).isBreached;
  }).length;

  const fetchRequests = async () => {
    const user = auth.currentUser;
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, "requests"),
        where("requesterId", "==", user.uid),
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
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [routeParams?.refreshToken]);

  useEffect(() => {
    if (!routeParams?.highlightRequestId) return;
    setHighlightRequestId(routeParams.highlightRequestId);
    const timer = setTimeout(() => {
      setHighlightRequestId(null);
      navigation.setParams?.({
        highlightRequestId: undefined,
        justCreated: undefined,
        justUpdated: undefined,
        refreshToken: undefined,
      });
    }, 8000);
    return () => clearTimeout(timer);
  }, [navigation, routeParams?.highlightRequestId]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const handleEditRequest = (item: Request) => {
    if (item.status === "completed") {
      Alert.alert("Not allowed", "Completed requests can no longer be edited.");
      return;
    }

    navigation.navigate("CreateRequest", {
      editRequestId: item.id,
      originalStatus: item.status,
      draft: {
        patientName: item.patientName || "",
        hospital: item.hospital || "",
        city: item.city || "",
        bloodType: item.bloodTypeNeeded || "",
        urgency: item.urgency || "Normal",
        contactNumber: item.contactNumber || "",
        selectedLocation: item.location || null,
        selectedLocationLabel: item.locationLabel || "",
      },
    });
  };

  const handleDeleteRequest = (item: Request) => {
    if (item.status === "completed") {
      Alert.alert("Not allowed", "Completed requests can no longer be deleted.");
      return;
    }

    Alert.alert("Delete Request", "Are you sure you want to delete this request?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setProcessingRequestId(item.id);
          try {
            await deleteDoc(doc(db, "requests", item.id));
            await syncPublicCityAvailability(db);
            setRequests((prev) => prev.filter((requestItem) => requestItem.id !== item.id));
            Alert.alert("Deleted", "Your request has been deleted.");
          } catch (error: any) {
            Alert.alert("Error", error?.message || "Failed to delete request.");
          } finally {
            setProcessingRequestId(null);
          }
        },
      },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "#f59e0b";
      case "accepted":
        return "#16a34a";
      case "completed":
        return "#2563eb";
      default:
        return "#6b7280";
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  };

  const renderItem = ({ item }: { item: Request }) => {
    const slaState = getRequestSlaState(item, now);
    return (
      <Pressable
        style={[styles.card, item.id === highlightRequestId && styles.highlightCard]}
        onPress={() => navigation.navigate("RequestDetail", { requestId: item.id })}
      >
        <View style={styles.cardTopRow}>
          <Text style={styles.patientName}>{item.patientName}</Text>
          <View style={[styles.statusPill, { backgroundColor: `${getStatusColor(item.status)}1A` }]}>
            <Text style={[styles.statusPillText, { color: getStatusColor(item.status) }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        {item.id === highlightRequestId && <Text style={styles.newTag}>Recently created request</Text>}
        {item.status === "pending" && (
          <Text
            style={[
              styles.slaText,
              slaState.tone === "danger" && styles.slaDanger,
              slaState.tone === "warning" && styles.slaWarning,
            ]}
          >
            Response Time: {slaState.label}
          </Text>
        )}
        <Text style={styles.infoText}>Hospital: {item.hospital}</Text>
        <Text style={styles.infoText}>
          Location: {item.locationLabel || item.city || "Unknown City"}
        </Text>
        <Text style={styles.infoText}>Blood Type: {item.bloodTypeNeeded}</Text>
        <Text style={styles.infoText}>Urgency: {item.urgency}</Text>
        {item.createdAt && <Text style={styles.timestamp}>Posted: {formatTimestamp(item.createdAt)}</Text>}
        {item.acceptedAt && <Text style={styles.timestamp}>Accepted: {formatTimestamp(item.acceptedAt)}</Text>}
        {item.completedAt && <Text style={styles.timestamp}>Completed: {formatTimestamp(item.completedAt)}</Text>}
        <View style={styles.itemActions}>
          <Button mode="text" compact onPress={() => navigation.navigate("RequestDetail", { requestId: item.id })}>
            View
          </Button>
          <Button mode="text" compact onPress={() => handleEditRequest(item)} disabled={processingRequestId === item.id}>
            Edit
          </Button>
          <Button
            mode="text"
            compact
            textColor="#b91c1c"
            onPress={() => handleDeleteRequest(item)}
            disabled={processingRequestId === item.id}
            loading={processingRequestId === item.id}
          >
            Delete
          </Button>
        </View>
      </Pressable>
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
      <View style={styles.backgroundOrbTop} pointerEvents="none" />
      <View style={styles.backgroundOrbBottom} pointerEvents="none" />

      <View style={styles.heroShell}>
        <View style={styles.heroGlowPrimary} pointerEvents="none" />
        <View style={styles.heroGlowSecondary} pointerEvents="none" />
        <View style={styles.pageHeader}>
          <Text style={styles.heroEyebrow}>My Requests</Text>
          <View style={styles.heroTopRow}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.pageTitle}>Track every request clearly</Text>
              <Text style={styles.pageSubtitle}>See which requests are pending, accepted, completed, or slipping past target response time.</Text>
            </View>
            <Button
              mode="contained"
              icon="plus-circle"
              style={styles.headerAction}
              buttonColor="#fff7ed"
              textColor="#7f1d1d"
              onPress={() => navigation.navigate("CreateRequest")}
            >
              Create Request
            </Button>
          </View>
        </View>
      </View>
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{pendingCount}</Text>
          <Text style={styles.metricLabel}>Pending</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{acceptedCount}</Text>
          <Text style={styles.metricLabel}>Accepted</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{completedCount}</Text>
          <Text style={styles.metricLabel}>Completed</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, breachedCount > 0 && styles.metricValueDanger]}>{breachedCount}</Text>
          <Text style={styles.metricLabel}>Over Target Time</Text>
        </View>
      </View>
      {justCreated && (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>Your request has been posted and is now active.</Text>
        </View>
      )}
      {justUpdated && (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>Your request has been updated.</Text>
        </View>
      )}

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No requests yet</Text>
            <Text style={styles.emptyBody}>Create a request to start connecting with available donors nearby.</Text>
            <Button mode="contained-tonal" icon="plus" onPress={() => navigation.navigate("CreateRequest")}>
              Create First Request
            </Button>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f6f2ec" },
  containerDesktop: {
    maxWidth: 1020,
    alignSelf: "center",
    width: "100%",
  },
  backgroundOrbTop: {
    position: "absolute",
    top: -70,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(244, 63, 94, 0.08)",
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: 20,
    left: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(251, 146, 60, 0.08)",
  },
  heroShell: {
    position: "relative",
    marginBottom: 14,
  },
  heroGlowPrimary: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 40,
    height: 120,
    borderRadius: 28,
    backgroundColor: "rgba(190, 24, 93, 0.14)",
  },
  heroGlowSecondary: {
    position: "absolute",
    top: 34,
    right: 0,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(249, 115, 22, 0.13)",
  },
  pageHeader: {
    backgroundColor: "#7f1d1d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 28,
    padding: 14,
  },
  heroEyebrow: {
    color: "#fecdd3",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    flexWrap: "wrap",
  },
  heroTextWrap: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 34,
    color: "#fffaf5",
  },
  pageSubtitle: {
    marginTop: 8,
    color: "#ffe4e6",
    fontSize: 14,
    lineHeight: 22,
  },
  headerAction: {
    borderRadius: 14,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  metricCard: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderColor: "#eadfd5",
    borderRadius: 18,
    backgroundColor: "#fffdf9",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  metricValue: {
    fontSize: 21,
    fontWeight: "800",
    color: "#b91c1c",
  },
  metricValueDanger: {
    color: "#b91c1c",
  },
  metricLabel: {
    color: "#6b7280",
    fontWeight: "600",
    marginTop: 2,
    fontSize: 12,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  card: {
    padding: 15,
    borderWidth: 1,
    borderColor: "#eadfd5",
    borderRadius: 20,
    marginBottom: 12,
    backgroundColor: "#fff",
    shadowColor: "#111827",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  highlightCard: {
    borderColor: "#fb923c",
    borderWidth: 2,
    backgroundColor: "#fff7ed",
  },
  newTag: {
    color: "#b45309",
    fontWeight: "800",
    marginBottom: 3,
  },
  slaText: {
    fontWeight: "800",
    color: "#15803d",
    marginBottom: 4,
  },
  slaWarning: {
    color: "#b45309",
  },
  slaDanger: {
    color: "#b91c1c",
  },
  successBanner: {
    borderWidth: 1,
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  successBannerText: {
    color: "#166534",
    fontWeight: "700",
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  patientName: { fontSize: 22, fontWeight: "800", color: "#111827" },
  statusPill: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
  },
  infoText: {
    fontSize: 17,
    color: "#1f2937",
    marginTop: 1,
  },
  timestamp: { fontSize: 13, color: "#6b7280", marginTop: 3 },
  itemActions: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
    flexWrap: "wrap",
  },
  emptyCard: {
    marginTop: 26,
    borderWidth: 1,
    borderColor: "#eadfd5",
    borderRadius: 24,
    backgroundColor: "#fffdf9",
    padding: 18,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },
  emptyBody: {
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 10,
  },
});


