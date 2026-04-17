import { useState, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import {
  Card,
  Text,
  IconButton,
  Button,
  Badge,
} from "react-native-paper";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useResponsive } from "../../utils/responsive";

type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: {
    requestId?: string;
    conversationId?: string;
    otherUserId?: string;
    userId?: string;
    [key: string]: any;
  } | null;
  read: boolean;
  createdAt: any;
};

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const currentUserId = auth.currentUser?.uid;
  const { role } = useAuth();
  const { isDesktop } = useResponsive();
  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", currentUserId),
        orderBy("createdAt", "desc")
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];
      setNotifications(list);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to load notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      Alert.alert("Error", "Failed to mark as read.");
    }
  };

  const navigateAdminNotification = (notification: Notification) => {
    const data = notification.data || {};

    if (notification.type === "support_message") {
      if (data.conversationId && data.otherUserId) {
        navigation.navigate("Chat", {
          conversationId: data.conversationId,
          otherUserId: data.otherUserId,
        });
        return;
      }
      navigation.navigate("AdminTabs", { screen: "Support" });
      return;
    }

    if (notification.type === "donor_pending") {
      if (data.userId) {
        navigation.navigate("AdminUserDetail", { userId: data.userId });
        return;
      }
      navigation.navigate("AdminTabs", {
        screen: "Donors",
      });
      return;
    }

    if (
      notification.type === "request_pending" ||
      notification.type === "request_accepted" ||
      notification.type === "request_completed"
    ) {
      if (data.requestId) {
        navigation.navigate("RequestDetail", { requestId: data.requestId });
        return;
      }
      navigation.navigate("AdminTabs", {
        screen: "Management",
      });
      return;
    }

    if (notification.type === "announcement_new") {
      navigation.navigate("AdminTabs", {
        screen: "Announcements",
      });
      return;
    }

    if (notification.type === "abuse_report") {
      navigation.navigate("AdminTabs", {
        screen: "Moderation",
      });
      return;
    }

    navigation.navigate("AdminTabs");
  };

  const navigateUserNotification = (notification: Notification) => {
    const data = notification.data || {};

    if (
      notification.type === "request_accepted" ||
      notification.type === "request_completed" ||
      notification.type === "request_pending"
    ) {
      if (data.requestId) {
        navigation.navigate("Feed", {
          screen: "RequestDetail",
          params: { requestId: data.requestId },
        });
        return;
      }
      navigation.navigate("Requests");
      return;
    }

    if (
      notification.type === "donor_approved" ||
      notification.type === "donor_rejected"
    ) {
      navigation.navigate("Profile", { screen: "ProfileMain" });
      return;
    }

    if (
      notification.type === "support_message" &&
      data.conversationId &&
      data.otherUserId
    ) {
      navigation.navigate("Feed", {
        screen: "Chat",
        params: {
          conversationId: data.conversationId,
          otherUserId: data.otherUserId,
        },
      });
      return;
    }

    if (notification.type === "announcement_new") {
      navigation.navigate("Feed", { screen: "FeedMain" });
    }
  };

  const openNotification = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    if (role === "admin") {
      navigateAdminNotification(notification);
      return;
    }

    navigateUserNotification(notification);
  };

  const deleteNotification = async (id: string) => {
    try {
      await deleteDoc(doc(db, "notifications", id));
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error: any) {
      console.error("deleteNotification error:", error);
      Alert.alert("Error", error?.message || "Failed to delete notification.");
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => {
      const ref = doc(db, "notifications", n.id);
      batch.update(ref, { read: true });
    });
    try {
      await batch.commit();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      Alert.alert("Success", "All notifications marked as read.");
    } catch {
      Alert.alert("Error", "Failed to mark all as read.");
    }
  };

  const deleteRead = async () => {
    const read = notifications.filter((n) => n.read);
    if (read.length === 0) return;
    const batch = writeBatch(db);
    read.forEach((n) => {
      const ref = doc(db, "notifications", n.id);
      batch.delete(ref);
    });
    try {
      await batch.commit();
      setNotifications((prev) => prev.filter((n) => !n.read));
      Alert.alert("Success", "Read notifications deleted.");
    } catch (error: any) {
      console.error("deleteRead error:", error);
      Alert.alert("Error", error?.message || "Failed to delete read notifications.");
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleString();
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <Card
      style={[styles.card, !item.read && styles.unreadCard]}
      onPress={() => openNotification(item)}
    >
      <Card.Content>
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <View style={styles.metaRow}>
              <Badge
                style={[
                  styles.statusBadge,
                  item.read ? styles.readBadge : styles.unreadBadge,
                ]}
              >
                {item.read ? "READ" : "UNREAD"}
              </Badge>
              <Text style={styles.time}>{formatDate(item.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            {!item.read && (
              <IconButton
                icon="check"
                size={20}
                onPress={() => markAsRead(item.id)}
                iconColor="green"
              />
            )}
            <IconButton
              icon="delete"
              size={20}
              onPress={() => deleteNotification(item.id)}
              iconColor="red"
            />
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Notifications</Text>
        <Text style={styles.pageSubtitle}>Read updates from requests, donors, and support messages.</Text>
        <View style={styles.headerMetaRow}>
          <Badge style={styles.unreadCountBadge}>{unreadCount}</Badge>
          <Text style={styles.headerMetaText}>Unread notifications</Text>
        </View>
      </View>
      <View style={styles.header}>
        <Button mode="text" onPress={markAllAsRead}>
          Mark all as read
        </Button>
        <Button mode="text" onPress={deleteRead}>
          Delete read
        </Button>
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchNotifications} />
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No notifications</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  pageHeader: {
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 14,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#b91c1c",
  },
  pageSubtitle: {
    marginTop: 4,
    color: "#4b5563",
    fontSize: 14,
  },
  headerMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  unreadCountBadge: {
    backgroundColor: "#d32f2f",
  },
  headerMetaText: {
    color: "#6b7280",
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    marginBottom: 4,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eceff3",
  },
  unreadCard: {
    backgroundColor: "#fff9e6",
    borderLeftWidth: 4,
    borderLeftColor: "#d32f2f",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
    color: "#111827",
  },
  body: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 4,
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
    color: "#999",
    marginLeft: 8,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  statusBadge: {
    alignSelf: "flex-start",
  },
  readBadge: {
    backgroundColor: "#2e7d32",
    color: "#fff",
  },
  unreadBadge: {
    backgroundColor: "#d32f2f",
    color: "#fff",
  },
  empty: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "#666",
  },
  containerDesktop: {
    maxWidth: 1000,
    width: "100%",
    alignSelf: "center",
  },
});

