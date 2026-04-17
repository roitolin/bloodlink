import { View, StyleSheet } from "react-native";
import { Text, Badge } from "react-native-paper";
import AdminAllRequestsScreen from "./AdminAllRequestsScreen";
import { useResponsive } from "../../utils/responsive";
import { useAdminManagementBreakdownCount } from "../../hooks/useAdminManagementBreakdownCount";

export default function AdminManagementScreen() {
  const { isDesktop } = useResponsive();
  const { requests, total } = useAdminManagementBreakdownCount();

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      {total > 0 && (
        <View style={styles.pendingBanner}>
          <Text style={styles.pendingBannerText}>Pending management notifications</Text>
          <Badge>{total > 99 ? "99+" : total}</Badge>
        </View>
      )}
      <View style={styles.queueHeader}>
        <Text style={styles.queueHeaderTitle}>Request Management</Text>
        <Text style={styles.queueHeaderMeta}>
          {requests > 0 ? `${requests} pending request alerts` : "No pending request alerts"}
        </Text>
      </View>
      <AdminAllRequestsScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  containerDesktop: { maxWidth: 800, alignSelf: "center", width: "100%" },
  pendingBanner: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: -4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#fff3e0",
    borderWidth: 1,
    borderColor: "#ffcc80",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pendingBannerText: {
    color: "#e65100",
    fontWeight: "700",
  },
  queueHeader: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: -4,
  },
  queueHeaderTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  queueHeaderMeta: {
    marginTop: 2,
    color: "#6b7280",
    fontWeight: "600",
  },
});

