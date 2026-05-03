import { useState, useEffect } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Card, Text, Avatar, IconButton } from "react-native-paper";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDoc,
  doc,
  getDocs,
  writeBatch,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { getDefaultProfileImage } from "../../utils/defaultProfileImage";

interface Conversation {
  id: string;
  participants: string[];
  hiddenFor?: string[];
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: any;
    readBy?: string[];
  };
  updatedAt: any;
}

type UserInfoMap = Record<
  string,
  { fullName?: string; email?: string; photoURL?: string; gender?: "male" | "female" | "other"; role?: string }
>;

const appLogo = require("../../../assets/Logo.png");

export default function ConversationsList({ navigation }: any) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [userInfoMap, setUserInfoMap] = useState<UserInfoMap>({});
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const userId = auth.currentUser?.uid;
  const { isDesktop } = useResponsive();

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((conversationDoc) => ({
          id: conversationDoc.id,
          ...conversationDoc.data(),
        })) as Conversation[];

        const visibleList = list.filter((conversation) => {
          if (conversation.hiddenFor?.includes(userId)) return false;
          const otherParticipant = conversation.participants.find((participantId) => participantId !== userId);
          if (otherParticipant && blockedUserIds.has(otherParticipant)) return false;
          return true;
        });

        visibleList.sort(
          (a, b) =>
            (b.updatedAt?.toDate?.()?.getTime?.() || 0) -
            (a.updatedAt?.toDate?.()?.getTime?.() || 0)
        );

        setConversations(visibleList);
        setFirebaseError(null);
        setLoading(false);
      },
      (error) => {
        console.error("Conversations listener error:", error);
        setFirebaseError(error?.message || "Failed to load conversations.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [blockedUserIds, userId]);

  useEffect(() => {
    if (!userId) return;

    let blockerSide = new Set<string>();
    let blockedSide = new Set<string>();

    const applySets = () => {
      const merged = new Set<string>([...blockerSide, ...blockedSide]);
      setBlockedUserIds(merged);
    };

    const syncBlockedIds = (snapshot: any, type: "asBlocker" | "asBlocked") => {
      const nextSet = new Set<string>();
      snapshot.docs.forEach((item: any) => {
        const data = item.data();
        if (data?.active === false) return;
        const otherId = type === "asBlocker" ? data?.blockedId : data?.blockerId;
        if (otherId) nextSet.add(otherId);
      });

      if (type === "asBlocker") {
        blockerSide = nextSet;
      } else {
        blockedSide = nextSet;
      }
      applySets();
    };

    const asBlockerQuery = query(collection(db, "user_blocks"), where("blockerId", "==", userId));
    const asBlockedQuery = query(collection(db, "user_blocks"), where("blockedId", "==", userId));
    const handleBlockListenerError = (error: any) => {
      console.warn("Blocked users listener warning:", error?.message || error);
      setBlockedUserIds(new Set());
    };

    const unsubA = onSnapshot(
      asBlockerQuery,
      (snapshot) => syncBlockedIds(snapshot, "asBlocker"),
      handleBlockListenerError
    );
    const unsubB = onSnapshot(
      asBlockedQuery,
      (snapshot) => syncBlockedIds(snapshot, "asBlocked"),
      handleBlockListenerError
    );

    return () => {
      unsubA();
      unsubB();
    };
  }, [userId]);

  useEffect(() => {
    const loadUserNames = async () => {
      if (!userId || conversations.length === 0) return;

      const otherUserIds = Array.from(
        new Set(
          conversations
            .map((conversation) =>
              conversation.participants.find((participantId) => participantId !== userId)
            )
            .filter(Boolean) as string[]
        )
      );

      const missingIds = otherUserIds.filter((id) => !userInfoMap[id]);
      if (missingIds.length === 0) return;

      const updates: UserInfoMap = {};
      await Promise.all(
        missingIds.map(async (otherUserId) => {
          try {
            const userSnap = await getDoc(doc(db, "users", otherUserId));
            const userData = userSnap.data();
            updates[otherUserId] = {
              fullName: userData?.fullName,
              email: userData?.email,
              photoURL: userData?.photoURL,
              gender: userData?.gender,
              role: userData?.role || "user",
            };
          } catch (error) {
            console.error("Failed loading user info:", error);
            updates[otherUserId] = {};
          }
        })
      );

      setUserInfoMap((prev) => ({ ...prev, ...updates }));
    };

    loadUserNames();
  }, [conversations, userId, userInfoMap]);

  const getOtherParticipant = (conversation: Conversation) => {
    return conversation.participants.find((participantId) => participantId !== userId) || "";
  };

  const setConversationReadState = async (
    conversation: Conversation,
    otherUserId: string,
    shouldRead: boolean
  ) => {
    if (!userId) return;

    try {
      const messagesRef = collection(db, "conversations", conversation.id, "messages");
      const q = query(messagesRef, where("senderId", "==", otherUserId));
      const snapshot = await getDocs(q);

      const batch = writeBatch(db);
      snapshot.docs.forEach((messageDoc) => {
        if (shouldRead) {
          batch.update(messageDoc.ref, { readBy: arrayUnion(userId) });
        } else {
          batch.update(messageDoc.ref, { readBy: arrayRemove(userId) });
        }
      });
      await batch.commit();

      const convRef = doc(db, "conversations", conversation.id);
      if (shouldRead) {
        await updateDoc(convRef, { "lastMessage.readBy": arrayUnion(userId) });
      } else {
        await updateDoc(convRef, { "lastMessage.readBy": arrayRemove(userId) });
      }
    } catch (error: any) {
      console.error("setConversationReadState error:", error);
      Alert.alert("Error", error?.message || "Failed to update read status.");
    }
  };

  const deleteConversation = async (conversationId: string) => {
    if (!userId) return;
    Alert.alert("Delete conversation", "Delete this conversation permanently?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const conversationRef = doc(db, "conversations", conversationId);

            // Fast path: hide from current user's list (works even when hard delete is blocked).
            await updateDoc(conversationRef, {
              hiddenFor: arrayUnion(userId),
            });

            // Optimistic local UI update.
            setConversations((prev) => prev.filter((conversation) => conversation.id !== conversationId));

            // Best effort hard delete (may be blocked by security rules).
            const messagesRef = collection(db, "conversations", conversationId, "messages");
            const messagesSnap = await getDocs(messagesRef);
            if (!messagesSnap.empty) {
              const batch = writeBatch(db);
              messagesSnap.docs.forEach((messageDoc) => batch.delete(messageDoc.ref));
              await batch.commit();
            }
            await deleteDoc(conversationRef);
          } catch (error: any) {
            if (error?.code === "permission-denied") {
              // Already hidden successfully in most cases; avoid blocking UX.
              return;
            }
            console.warn("deleteConversation warning:", error?.message || error);
            Alert.alert("Error", error?.message || "Failed to delete conversation.");
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const otherUserId = getOtherParticipant(item);
    const otherUser = userInfoMap[otherUserId];
    const displayName =
      otherUser?.fullName ||
      otherUser?.email ||
      `User ${otherUserId.slice(0, 6)}`;

    const subtitlePrefix = item.lastMessage?.senderId === userId ? "You: " : "";
    const unread =
      !!userId &&
      !!item.lastMessage &&
      item.lastMessage.senderId !== userId &&
      (!item.lastMessage.readBy || !item.lastMessage.readBy.includes(userId));

    const fallbackSource = getDefaultProfileImage(otherUser?.gender);
    const avatarSource =
      String(otherUser?.role || "").toLowerCase() === "admin"
        ? appLogo
        : otherUser?.photoURL
        ? { uri: otherUser.photoURL }
        : fallbackSource;

    return (
      <Card style={[styles.card, unread && styles.unreadCard]} mode="elevated">
        <TouchableOpacity
          onPress={() => navigation.navigate("Chat", { conversationId: item.id, otherUserId })}
          activeOpacity={0.7}
        >
          <Card.Title
            title={displayName}
            subtitle={`${subtitlePrefix}${item.lastMessage?.text || "No messages yet"}`}
            left={(props) =>
              <Avatar.Image {...props} source={avatarSource as any} />
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

        <Card.Actions style={styles.actions}>
          <IconButton
            icon="check-circle-outline"
            size={20}
            iconColor={unread ? "rgba(211,47,47,0.45)" : "#2e7d32"}
            onPress={() => setConversationReadState(item, otherUserId, true)}
          />
          <Text
            style={[
              styles.actionLabel,
              { color: unread ? "rgba(211,47,47,0.45)" : "#2e7d32" },
            ]}
          >
            Read
          </Text>

          <IconButton
            icon="email-mark-as-unread"
            size={20}
            onPress={() => setConversationReadState(item, otherUserId, false)}
          />
          <Text style={styles.actionLabel}>Unread</Text>

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
      {!!firebaseError && <Text style={styles.error}>{firebaseError}</Text>}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.empty}>No conversations yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#f5f5f5" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  empty: { textAlign: "center", marginTop: 50, fontSize: 16 },
  error: { color: "#d32f2f", textAlign: "center", marginBottom: 12 },
  card: { marginBottom: 10 },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#d32f2f",
  },
  time: { fontSize: 12, color: "#888", alignSelf: "center", marginRight: 10 },
  actions: {
    justifyContent: "flex-start",
    alignItems: "center",
    gap: 2,
    paddingLeft: 8,
    paddingBottom: 8,
  },
  actionLabel: {
    fontSize: 12,
    color: "#555",
    marginRight: 8,
  },
  containerDesktop: { maxWidth: 800, alignSelf: "center", width: "100%" },
});

