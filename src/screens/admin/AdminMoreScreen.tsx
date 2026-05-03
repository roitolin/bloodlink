import { ScrollView, StyleSheet, View } from "react-native";
import { Badge, Button, Card, Text } from "react-native-paper";
import { useAdminManagementBreakdownCount } from "../../hooks/useAdminManagementBreakdownCount";
import { useAdminNotificationCount } from "../../hooks/useAdminNotificationCount";
import { useUnreadSupportCount } from "../../hooks/useUnreadSupportCount";
import { useResponsive } from "../../utils/responsive";
import { useAuth } from "../../context/AuthContext";

export default function AdminMoreScreen({ navigation }: any) {
  const { role } = useAuth();
  const { isDesktop } = useResponsive();
  const unreadSupportCount = useUnreadSupportCount();
  const adminNotificationCount = useAdminNotificationCount();
  const { donors: donorPendingCount, requests: requestPendingCount } = useAdminManagementBreakdownCount();
  const isBloodAdmin = role === "admin" || role === "blood_admin";
  const isFuneralAdmin = role === "admin" || role === "funeral_admin";
  const canSeeCommsAndInsights = role === "admin" || role === "blood_admin";
  const separatedToolsDescription =
    role === "blood_admin"
      ? "Open dedicated admin areas for blood operations and deeper monitoring controls."
      : role === "funeral_admin"
        ? "Open dedicated admin areas for funeral shops and deeper monitoring controls."
        : "Open dedicated admin areas for blood operations, funeral shops, and deeper monitoring controls.";

  return (
    <ScrollView contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={styles.title}>
          More Tools
        </Text>
        <Text style={styles.subtitle}>
          Use this area for secondary admin actions to keep the main navbar cleaner.
        </Text>
        <View style={styles.headerMetaRow}>
          {isBloodAdmin ? (
            <View style={styles.headerMetaItem}>
              <Badge style={styles.metaBadge}>{requestPendingCount > 99 ? "99+" : requestPendingCount}</Badge>
              <Text style={styles.metaLabel}>Request Alerts</Text>
            </View>
          ) : null}
          {isBloodAdmin ? (
            <View style={styles.headerMetaItem}>
              <Badge style={styles.metaBadge}>{donorPendingCount > 99 ? "99+" : donorPendingCount}</Badge>
              <Text style={styles.metaLabel}>Donor Alerts</Text>
            </View>
          ) : null}
          {canSeeCommsAndInsights ? (
            <View style={styles.headerMetaItem}>
              <Badge style={styles.metaBadge}>{unreadSupportCount > 99 ? "99+" : unreadSupportCount}</Badge>
              <Text style={styles.metaLabel}>Support Unread</Text>
            </View>
          ) : null}
          <View style={styles.headerMetaItem}>
            <Badge style={styles.metaBadge}>{adminNotificationCount > 99 ? "99+" : adminNotificationCount}</Badge>
            <Text style={styles.metaLabel}>All Notifications</Text>
          </View>
        </View>
      </View>

      {canSeeCommsAndInsights ? (
        <Card style={styles.card} mode="elevated">
          <Card.Title title="Communication Tools" />
          <Card.Content>
            <Text style={styles.cardText}>
              Manage support, public notices, and community response tools.
            </Text>
          </Card.Content>
          <Card.Actions style={styles.multiActions}>
            <Button mode="contained" onPress={() => navigation.navigate("Support")}>
              Support Inbox
            </Button>
            <Button mode="outlined" onPress={() => navigation.navigate("Announcements")}>
              Announcements
            </Button>
            <Button mode="outlined" onPress={() => navigation.navigate("Feedback")}>
              Rate & Feedback
            </Button>
            <Button mode="text" onPress={() => navigation.navigate("Notifications")}>
              Notifications
            </Button>
          </Card.Actions>
        </Card>
      ) : null}

      <Card style={styles.card} mode="elevated">
        <Card.Title title="Separated Admin Tools" />
        <Card.Content>
          <Text style={styles.cardText}>
            {separatedToolsDescription}
          </Text>
        </Card.Content>
        <Card.Actions style={styles.multiActions}>
          {isBloodAdmin ? (
            <Button mode="contained-tonal" onPress={() => navigation.navigate("Blood")}>
              Admin Blood
            </Button>
          ) : null}
          {isFuneralAdmin ? (
            <Button mode="contained-tonal" onPress={() => navigation.navigate("Funeral")}>
              Shops
            </Button>
          ) : null}
          {canSeeCommsAndInsights ? (
            <Button mode="contained-tonal" onPress={() => navigation.navigate("Analytics")}>
              Analytics
            </Button>
          ) : null}
          <Button mode="contained-tonal" onPress={() => navigation.navigate("Moderation")}>
            Moderation
          </Button>
          <Button mode="outlined" onPress={() => navigation.navigate("AuditLogs")}>
            Audit Logs
          </Button>
        </Card.Actions>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    gap: 12,
  },
  containerDesktop: {
    maxWidth: 860,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff5f5",
    padding: 14,
  },
  title: {
    color: "#991b1b",
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 4,
    color: "#4b5563",
    lineHeight: 20,
  },
  headerMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  headerMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaBadge: {
    backgroundColor: "#b91c1c",
  },
  metaLabel: {
    color: "#4b5563",
    fontWeight: "700",
    fontSize: 12,
  },
  card: {
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  cardText: {
    color: "#4b5563",
    lineHeight: 20,
  },
  multiActions: {
    flexWrap: "wrap",
    gap: 8,
  },
});

