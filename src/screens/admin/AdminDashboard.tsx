import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View, Text, StyleSheet } from "react-native";
import { Button, Card, ActivityIndicator } from "react-native-paper";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useResponsive } from "../../utils/responsive";
import { useAppDialog } from "../../hooks/useAppDialog";
import { useDoubleTapAction } from "../../hooks/useDoubleTapAction";

type DashboardMetrics = {
  totalUsers: number;
  pendingVerifications: number;
  pendingFuneralShops: number;
  activeDonors: number;
  pendingRequests: number;
};

const EMPTY_METRICS: DashboardMetrics = {
  totalUsers: 0,
  pendingVerifications: 0,
  pendingFuneralShops: 0,
  activeDonors: 0,
  pendingRequests: 0,
};

export default function AdminDashboard({ navigation }: any) {
  const { logout, role } = useAuth();
  const { isDesktop } = useResponsive();
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { showDialog, dialog } = useAppDialog();
  const isBloodAdmin = role === "admin" || role === "blood_admin";
  const isFuneralAdmin = role === "admin" || role === "funeral_admin";
  const title = role === "blood_admin" ? "Blood Admin" : role === "funeral_admin" ? "Funeral Admin" : "Admin Dashboard";
  const subtitle =
    role === "blood_admin"
      ? "Monitor blood verification, requests, users, and support tools."
      : role === "funeral_admin"
        ? "Monitor funeral shop approvals, users, and support tools."
        : "Monitor blood operations, funeral shop approvals, users, and support channels.";

  const handleLogout = () => {
    showDialog({
      title: "Log Out of Admin Panel?",
      message: "You’ll be signed out of the admin dashboard on this device.",
      tone: "warning",
      actions: [
        { label: "Cancel", mode: "text" },
        {
          label: "Log Out",
          mode: "contained",
          onPress: async () => {
            try {
              await logout();
            } catch (error: any) {
              showDialog({
                title: "Logout Failed",
                message: error?.message || "Failed to log out.",
                tone: "danger",
              });
            }
          },
        },
      ],
    });
  };

  const loadMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      const [allUsersSnap, pendingDonorSnap, pendingFuneralShopSnap, verifiedDonorSnap, pendingRequestSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(query(collection(db, "users"), where("donorStatus", "==", "pending"))),
        getDocs(query(collection(db, "users"), where("funeralShopStatus", "==", "pending"))),
        getDocs(query(collection(db, "users"), where("donorStatus", "==", "verified"))),
        getDocs(query(collection(db, "requests"), where("status", "==", "pending"))),
      ]);

      const activeDonors = verifiedDonorSnap.docs.filter(
        (item) => item.data()?.availabilityStatus === "available"
      ).length;

      setMetrics({
        totalUsers: allUsersSnap.size,
        pendingVerifications: pendingDonorSnap.size,
        pendingFuneralShops: pendingFuneralShopSnap.size,
        activeDonors,
        pendingRequests: pendingRequestSnap.size,
      });
    } catch (error) {
      console.error("Failed to load dashboard metrics:", error);
      setMetrics(EMPTY_METRICS);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadMetrics();
    } finally {
      setRefreshing(false);
    }
  }, [loadMetrics]);

  const handleDoubleTapRefresh = useDoubleTapAction(refreshDashboard);

  return (
    <ScrollView
      contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshDashboard} />}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Button mode="outlined" icon="refresh" onPress={handleDoubleTapRefresh} compact>
          Refresh x2
        </Button>
      </View>

      {loadingMetrics ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" />
          <Text style={styles.loadingText}>Loading live metrics...</Text>
        </View>
      ) : (
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard} mode="elevated">
            <Card.Content>
              <Text style={styles.metricValue}>{metrics.totalUsers}</Text>
              <Text style={styles.metricDesc}>Total Users</Text>
            </Card.Content>
          </Card>
          {isBloodAdmin ? (
            <Card style={styles.metricCard} mode="elevated">
              <Card.Content>
                <Text style={styles.metricValue}>{metrics.activeDonors}</Text>
                <Text style={styles.metricDesc}>Active Blood Donors</Text>
              </Card.Content>
            </Card>
          ) : null}
          {isBloodAdmin ? (
            <Card style={styles.metricCard} mode="elevated">
              <Card.Content>
                <Text style={styles.metricValue}>{metrics.pendingVerifications}</Text>
                <Text style={styles.metricDesc}>Pending Blood Verifications</Text>
              </Card.Content>
            </Card>
          ) : null}
          {isBloodAdmin ? (
            <Card style={styles.metricCard} mode="elevated">
              <Card.Content>
                <Text style={styles.metricValue}>{metrics.pendingRequests}</Text>
                <Text style={styles.metricDesc}>Pending Requests</Text>
              </Card.Content>
            </Card>
          ) : null}
          {isFuneralAdmin ? (
            <Card style={styles.metricCard} mode="elevated">
              <Card.Content>
                <Text style={styles.metricValue}>{metrics.pendingFuneralShops}</Text>
                <Text style={styles.metricDesc}>Pending Shop Verifications</Text>
              </Card.Content>
            </Card>
          ) : null}
        </View>
      )}

      {isBloodAdmin ? (
        <Card style={styles.actionCard} mode="elevated">
          <Card.Title title="Admin Blood Verification Queue" />
          <Card.Content>
            <Text style={styles.cardText}>
              Review submitted blood donor documents and approve or reject verification requests.
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained" onPress={() => navigation.navigate("Blood")}>
              Open Queue ({metrics.pendingVerifications})
            </Button>
          </Card.Actions>
        </Card>
      ) : null}

      {isFuneralAdmin ? (
        <Card style={styles.actionCard} mode="elevated">
          <Card.Title title="Admin Funeral Shop Verification Queue" />
          <Card.Content>
            <Text style={styles.cardText}>
              Review funeral shop registrations, inspect business records, and approve or reject shop submissions.
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained-tonal" onPress={() => navigation.navigate("Funeral")}>
              Open Queue ({metrics.pendingFuneralShops})
            </Button>
          </Card.Actions>
        </Card>
      ) : null}

      {isBloodAdmin ? (
        <Card style={styles.actionCard} mode="elevated">
          <Card.Title title="Request Management" />
          <Card.Content>
            <Text style={styles.cardText}>
              Inspect pending requests, review urgency, and open full request details.
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained-tonal" onPress={() => navigation.navigate("Management")}>
              Open Requests ({metrics.pendingRequests})
            </Button>
          </Card.Actions>
        </Card>
      ) : null}

      <Card style={styles.actionCard} mode="elevated">
        <Card.Title title="User Management" />
        <Card.Content>
          <Text style={styles.cardText}>
            View user profiles, inspect request history, and manage user records.
          </Text>
        </Card.Content>
        <Card.Actions>
          <Button mode="contained-tonal" onPress={() => navigation.navigate("Users")}>
            Manage Users
          </Button>
        </Card.Actions>
      </Card>

      <Card style={styles.actionCard} mode="elevated">
        <Card.Title title="Analytics & Monitoring" />
        <Card.Content>
          <Text style={styles.cardText}>
            Check donation trends, activity metrics, and engagement insights.
          </Text>
        </Card.Content>
        <Card.Actions>
          <Button mode="outlined" onPress={() => navigation.navigate("Analytics")}>
            View Analytics
          </Button>
        </Card.Actions>
      </Card>

      <Card style={styles.actionCard} mode="elevated">
        <Card.Title title="Ratings & Feedback" />
        <Card.Content>
          <Text style={styles.cardText}>
            Review user ratings, reply to feedback, and react to community comments.
          </Text>
        </Card.Content>
        <Card.Actions>
          <Button mode="outlined" onPress={() => navigation.navigate("Feedback")}>
            Open Feedback Board
          </Button>
        </Card.Actions>
      </Card>

      <View style={styles.logoutWrap}>
        <Button mode="contained" buttonColor="#c62828" onPress={handleLogout}>
          Logout
        </Button>
      </View>
      {dialog}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f5f5f5",
    gap: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  headerTextWrap: {
    flex: 1,
  },
  title: { fontSize: 30, fontWeight: "800", marginTop: 4, color: "#d32f2f" },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 6 },
  loadingWrap: {
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "#4b5563",
    fontWeight: "600",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricCard: {
    width: "48%",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  metricValue: { fontSize: 24, fontWeight: "800", color: "#b71c1c" },
  metricDesc: { fontSize: 12, color: "#666", marginTop: 4 },
  actionCard: {
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  cardText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 21,
  },
  logoutWrap: {
    marginTop: 8,
    marginBottom: 10,
  },
  containerDesktop: { maxWidth: 700, alignSelf: "center", width: "100%" },
});

