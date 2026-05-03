import { useState, useEffect, useCallback } from "react";
import {
  View,
  FlatList,
  Alert,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { Card, Text, Avatar, IconButton } from "react-native-paper";
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  onSnapshot,
  updateDoc,
  writeBatch,
  deleteDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { getDefaultProfileImage } from "../../utils/defaultProfileImage";

type Conversation = {
  id: string;
  participants: string[];
  hiddenFor?: string[];
  lastMessage?: {
    text: string;
    timestamp: any;
    senderId: string;
    readBy?: string[];
  };
  updatedAt: any;
};

type UserInfoMap = Record<
  string,
  { fullName?: string; email?: string; photoURL?: string; gender?: "male" | "female" | "other" }
>;

type UnreadCounts = Record<string, number>;

export default function AdminSupportMessages({ navigation }: any) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [userInfoMap, setUserInfoMap] = useState<UserInfoMap>({});
  const { isDesktop } = useResponsive();
  const currentUserId = auth.currentUser?.uid;

  const loadConversationMeta = useCallback(
    async (visibleConversations: Conversation[]) => {
      if (!currentUserId) return;

      try {
        const otherUserIds = Array.from(
          new Set(
            visibleConversations
              .map((conversation) =>
                conversation.participants.find((participantId) => participantId !== currentUserId)
              )
              .filter(Boolean) as string[]
          )
        );

        const nextUserInfo: UserInfoMap = {};
        await Promise.all(
          otherUserIds.map(async (otherUserId) => {
            try {
              const userSnap = await getDoc(doc(db, "users", otherUserId));
              const userData = userSnap.data();
              nextUserInfo[otherUserId] = {
                fullName: userData?.fullName,
                email: userData?.email,
                photoURL: userData?.photoURL,
                gender: userData?.gender,
              };
            } catch {
              nextUserInfo[otherUserId] = {};
            }
          })
        );
        setUserInfoMap(nextUserInfo);

        const unreadMap: UnreadCounts = {};
        await Promise.all(
          visibleConversations.map(async (conversation) => {
            const otherUserId = conversation.participants.find(
              (participantId) => participantId !== currentUserId
            );
            if (!otherUserId) {
              unreadMap[conversation.id] = 0;
              return;
            }

            const messagesRef = collection(db, "conversations", conversation.id, "messages");
            const qMessages = query(messagesRef, where("senderId", "==", otherUserId));
            const messagesSnap = await getDocs(qMessages);

            let unreadCount = 0;
            messagesSnap.forEach((messageDoc) => {
              const messageData = messageDoc.data();
              if (!messageData.readBy || !messageData.readBy.includes(currentUserId)) {
                unreadCount += 1;
              }
            });
            unreadMap[conversation.id] = unreadCount;
          })
        );

        setUnreadCounts(unreadMap);
      } catch (error) {
        console.error("Error loading support conversation metadata:", error);
        Alert.alert("Error", "Failed to load support conversations.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentUserId]
  );

  useEffect(() => {
    if (!currentUserId) {
      setConversations([]);
      setUnreadCounts({});
      setUserInfoMap({});
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", currentUserId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const allConversations = snapshot.docs.map((conversationDoc) => ({
          id: conversationDoc.id,
          ...conversationDoc.data(),
        })) as Conversation[];

        const visibleConversations = allConversations
          .filter((conversation) => !conversation.hiddenFor?.includes(currentUserId))
          .sort(
            (a, b) =>
              (b.updatedAt?.toDate?.()?.getTime?.() || 0) -
              (a.updatedAt?.toDate?.()?.getTime?.() || 0)
          );

        setConversations(visibleConversations);
        void loadConversationMeta(visibleConversations);
      },
      (error) => {
        console.error("Support inbox listener error:", error);
        setLoading(false);
        setRefreshing(false);
        Alert.alert("Error", "Failed to load support conversations.");
      }
    );

    return unsubscribe;
  }, [currentUserId, loadConversationMeta]);

  const onRefresh = () => {
    setRefreshing(true);
    void loadConversationMeta(conversations);
  };

  const setConversationReadState = async (
    conversationId: string,
    otherUserId: string,
    shouldRead: boolean
  ) => {
    if (!currentUserId) return;

    try {
      const messagesRef = collection(db, "conversations", conversationId, "messages");
      const qMessages = query(messagesRef, where("senderId", "==", otherUserId));
      const messagesSnap = await getDocs(qMessages);

      const batch = writeBatch(db);
      messagesSnap.docs.forEach((messageDoc) => {
        if (shouldRead) {
          batch.update(messageDoc.ref, { readBy: arrayUnion(currentUserId) });
        } else {
          batch.update(messageDoc.ref, { readBy: arrayRemove(currentUserId) });
        }
      });
      await batch.commit();

      const conversationRef = doc(db, "conversations", conversationId);
      if (shouldRead) {
        await updateDoc(conversationRef, { "lastMessage.readBy": arrayUnion(currentUserId) });
      } else {
        await updateDoc(conversationRef, { "lastMessage.readBy": arrayRemove(currentUserId) });
      }
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to update read state.");
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!currentUserId) return;

    Alert.alert("Delete conversation", "Delete this conversation permanently?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const conversationRef = doc(db, "conversations", conversationId);
            await updateDoc(conversationRef, {
              hiddenFor: arrayUnion(currentUserId),
            });

            setConversations((prev) =>
              prev.filter((conversation) => conversation.id !== conversationId)
            );

            const messagesRef = collection(db, "conversations", conversationId, "messages");
            const messagesSnap = await getDocs(messagesRef);
            if (!messagesSnap.empty) {
              const batch = writeBatch(db);
              messagesSnap.docs.forEach((messageDoc) => batch.delete(messageDoc.ref));
              await batch.commit();
            }
            await deleteDoc(conversationRef);
          } catch (error: any) {
            if (error?.code === "permission-denied") return;
            Alert.alert("Error", error?.message || "Failed to delete conversation.");
          }
        },
      },
    ]);
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const otherUserId = item.participants.find(
            (participantId) => participantId !== currentUserId
          );
          if (!otherUserId) return null;

          const otherUser = userInfoMap[otherUserId];
          const displayName =
            otherUser?.fullName || otherUser?.email || `User ${otherUserId.slice(0, 6)}`;
          const isUnread = (unreadCounts[item.id] || 0) > 0;
          const subtitlePrefix = item.lastMessage?.senderId === currentUserId ? "You: " : "";

          return (
            <Card style={[styles.card, isUnread && styles.unreadCard]} mode="elevated">
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate("Chat", {
                    conversationId: item.id,
                    otherUserId,
                  })
                }
                activeOpacity={0.7}
              >
                <Card.Title
                  title={displayName}
                  subtitle={`${subtitlePrefix}${item.lastMessage?.text || "No messages yet"}`}
                  left={(props) =>
                    otherUser?.photoURL ? (
                      <Avatar.Image {...props} source={{ uri: otherUser.photoURL }} />
                    ) : (
                      <Avatar.Image
                        {...props}
                        source={getDefaultProfileImage(otherUser?.gender)}
                      />
                    )
                  }
                  right={(props) =>
                    item.lastMessage?.timestamp ? (
                      <Text {...props} style={styles.time}>
                        {item.lastMessage.timestamp.toDate().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    ) : null
                  }
                />
              </TouchableOpacity>

              <View style={styles.profileActionRow}>
                <TouchableOpacity onPress={() => navigation.navigate("AdminUserDetail", { userId: otherUserId })}>
                  <Text style={styles.viewProfileText}>View Profile</Text>
                </TouchableOpacity>
              </View>

              <Card.Actions style={styles.actions}>
                <IconButton
                  icon="check-circle-outline"
                  size={20}
                  iconColor={isUnread ? "rgba(211,47,47,0.45)" : "#2e7d32"}
                  onPress={() => setConversationReadState(item.id, otherUserId, true)}
                />
                <Text
                  style={[
                    styles.actionLabel,
                    { color: isUnread ? "rgba(211,47,47,0.45)" : "#2e7d32" },
                  ]}
                >
                  Read
                </Text>

                <IconButton
                  icon="email-mark-as-unread"
                  size={20}
                  iconColor="#d32f2f"
                  onPress={() => setConversationReadState(item.id, otherUserId, false)}
                />
                <Text style={[styles.actionLabel, { color: "#d32f2f" }]}>Unread</Text>

                <IconButton
                  icon="delete-outline"
                  size={20}
                  iconColor="#d32f2f"
                  onPress={() => deleteConversation(item.id)}
                />
                <Text style={[styles.actionLabel, { color: "#d32f2f" }]}>Delete</Text>
              </Card.Actions>
            </Card>
          );
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No support conversations yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 20,
  },
  containerDesktop: {
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  card: { marginBottom: 10 },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#d32f2f",
  },
  time: {
    fontSize: 12,
    color: "#888",
    alignSelf: "center",
    marginRight: 10,
  },
  actions: {
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 2,
    paddingLeft: 8,
    paddingBottom: 8,
  },
  profileActionRow: {
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 4,
  },
  viewProfileText: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 13,
  },
  actionLabel: {
    fontSize: 12,
    color: "#555",
    marginRight: 8,
  },
  empty: {
    textAlign: "center",
    marginTop: 50,
    fontSize: 16,
    color: "#666",
  },
});

