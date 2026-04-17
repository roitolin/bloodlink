import { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  FlatList,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
  Button,
  Keyboard,
  Linking,
  SafeAreaView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Card, Text, useTheme, IconButton, Avatar } from "react-native-paper";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  writeBatch,
  arrayUnion,
  arrayRemove,
  where,
} from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { getDefaultProfileImage } from "../../utils/defaultProfileImage";
import { useAuth } from "../../context/AuthContext";
import { ensureConversationForUsers, getConversationId } from "../../utils/chatHelpers";
import { blockUser, getBlockStateBetweenUsers, unblockUser } from "../../utils/userModeration";
import { ensureDonorCanAcceptRequest } from "../../utils/donorAcceptance";
import { syncPublicCityAvailability } from "../../utils/publicCityAvailability";
import { useAppDialog } from "../../hooks/useAppDialog";

const EMOJIS = ["👍", "😂", "❤️", "😮", "😢", "🙏"];

const APP_LOGO = require("../../../assets/Logo.png");

export default function ChatScreen({ route, navigation }: any) {
  const { conversationId, otherUserId, requestId } = route.params || {};
  const { role } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [replyTo, setReplyTo] = useState<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const userId = auth.currentUser?.uid;
  const { isDesktop } = useResponsive();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [editText, setEditText] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [otherUserName, setOtherUserName] = useState("User");
  const [otherUserPhoto, setOtherUserPhoto] = useState<string | null>(null);
  const [otherUserGender, setOtherUserGender] = useState<"male" | "female" | "other">("other");
  const [otherUserRole, setOtherUserRole] = useState("user");
  const [otherUserPhone, setOtherUserPhone] = useState<string | null>(null);
  const [requestContext, setRequestContext] = useState<any>(null);
  const [acceptingRequest, setAcceptingRequest] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [blockState, setBlockState] = useState({ blockedByMe: false, blockedMe: false, blockedEitherWay: false });
  const [safetySheetVisible, setSafetySheetVisible] = useState(false);
  const { showDialog, dialog } = useAppDialog();

  const messageRefs = useRef<{ [key: string]: View | null }>({});

  const refreshBlockState = useCallback(async () => {
    if (!userId || !otherUserId) return;
    try {
      const state = await getBlockStateBetweenUsers(userId, otherUserId);
      setBlockState(state);
    } catch (error) {
      console.warn("Failed to load block state:", error);
    }
  }, [otherUserId, userId]);

  const openModerationMenu = useCallback(() => {
    if (!userId || !otherUserId) return;
    setSafetySheetVisible(true);
  }, [otherUserId, userId]);

  const submitReportFromSafetyTools = useCallback(() => {
    if (!otherUserId) return;
    setSafetySheetVisible(false);
    navigation.navigate("ReportCenter", {
      targetUserId: otherUserId,
      conversationId,
      requestId: requestId || null,
      source: "chat",
    });
  }, [conversationId, navigation, otherUserId, requestId]);

  const handleBlockToggleFromSafetyTools = useCallback(async () => {
    if (!userId || !otherUserId) return;
    try {
      if (blockState.blockedByMe) {
        await unblockUser(userId, otherUserId);
      } else {
        await blockUser(userId, otherUserId, "chat_safety");
      }
      await refreshBlockState();
      Alert.alert("Updated", blockState.blockedByMe ? "User has been unblocked." : "User has been blocked.");
      setSafetySheetVisible(false);
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to update safety tools.");
    }
  }, [blockState.blockedByMe, otherUserId, refreshBlockState, userId]);

  const openPhoneLink = useCallback(
    async (mode: "call" | "sms") => {
      const rawPhone = String(otherUserPhone || "").trim();
      if (!rawPhone) {
        Alert.alert("Unavailable", "This user has no contact number available.");
        return;
      }

      const sanitizedPhone = rawPhone.replace(/\s+/g, "");
      const url =
        mode === "call"
          ? `tel:${sanitizedPhone}`
          : `sms:${sanitizedPhone}?body=${encodeURIComponent("Hi, this is from BloodLink chat.")}`;
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert("Unavailable", mode === "call" ? "Call is not available on this device." : "SMS is not available on this device.");
        return;
      }
      await Linking.openURL(url);
    },
    [otherUserPhone]
  );

  // Hide bottom tab bar while inside the conversation screen.
  useFocusEffect(
    useCallback(() => {
      const parentNavigator = navigation.getParent?.();
      const grandParentNavigator = parentNavigator?.getParent?.();
      const navigators = [navigation, parentNavigator, grandParentNavigator].filter(Boolean);

      const tabNavigator = navigators.find(
        (nav: any) => nav?.getState?.()?.type === "tab"
      );

      if (!tabNavigator) return undefined;

      tabNavigator.setOptions?.({ tabBarStyle: { display: "none" } });

      return () => {
        tabNavigator.setOptions?.({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  // Fetch other user's details and set header with tappable avatar/name
  useLayoutEffect(() => {
    const fetchUserDetails = async () => {
      if (!otherUserId) return;
      try {
        const userDoc = await getDoc(doc(db, "users", otherUserId));
        const userData = userDoc.data();
        const fullName = userData?.fullName || "User";
        const photoURL = userData?.photoURL || null;
        const gender = userData?.gender || "other";
        const userRole = String(userData?.role || "user");
        const phoneNumber = userData?.contactNumber || userData?.phone || userData?.mobileNumber || null;
        setOtherUserName(fullName);
        setOtherUserPhoto(photoURL);
        setOtherUserGender(gender);
        setOtherUserRole(userRole);
        setOtherUserPhone(phoneNumber);
        const isOtherUserAdmin = String(userRole).toLowerCase() === "admin";
        const canOpenProfile = !(role !== "admin" && isOtherUserAdmin);
        const openProfile = () => {
          if (!canOpenProfile) return;
          if (role === "admin") {
            navigation.navigate("AdminUserDetail", { userId: otherUserId, fromChatConversation: true });
            return;
          }
          navigation.navigate("DonorDetail", { donorId: otherUserId });
        };

        navigation.setOptions({
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerProfile}
                onPress={openProfile}
                disabled={!canOpenProfile}
              >
                {String(userRole).toLowerCase() === "admin" ? (
                  <Avatar.Image size={36} source={APP_LOGO} />
                ) : photoURL ? (
                  <Avatar.Image size={36} source={{ uri: photoURL }} />
                ) : (
                  <Avatar.Image size={36} source={getDefaultProfileImage(gender)} />
                )}
                <View style={styles.headerTextWrap}>
                  <Text style={styles.headerName}>{fullName}</Text>
                  {canOpenProfile ? <Text style={styles.headerProfileHint}>View Profile</Text> : null}
                </View>
              </TouchableOpacity>
            </View>
          ),
          headerTitle: "",
          headerRight:
            role !== "admin"
              ? () => (
                  <View style={styles.headerActionsWrap}>
                    <TouchableOpacity style={styles.headerModerationButton} onPress={() => openPhoneLink("call")}>
                      <Ionicons name="call-outline" size={20} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerModerationButton} onPress={() => openPhoneLink("sms")}>
                      <Ionicons name="chatbubble-ellipses-outline" size={20} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.headerModerationButton} onPress={openModerationMenu}>
                      <Ionicons name="shield-outline" size={22} color="white" />
                    </TouchableOpacity>
                  </View>
                )
              : undefined,
          headerStyle: { backgroundColor: theme.colors.primary },
          headerTintColor: "#fff",
        });
      } catch (error) {
        console.error("Error fetching user details:", error);
        navigation.setOptions({ title: "User" });
      }
    };
    fetchUserDetails();
  }, [otherUserId, navigation, openModerationMenu, openPhoneLink, theme, role]);

  useEffect(() => {
    refreshBlockState();
  }, [refreshBlockState]);

  // Fetch messages and mark conversation's last message as read
  useEffect(() => {
    const ensureConversation = async () => {
      if (!userId || !otherUserId) return;
      try {
        await ensureConversationForUsers(db, userId, otherUserId);
      } catch (error) {
        console.warn("Failed to initialize conversation:", error);
      }
    };
    void ensureConversation();
  }, [otherUserId, userId]);

  useEffect(() => {
    const q = query(
      collection(db, "conversations", conversationId, "messages"),
      orderBy("timestamp", "asc")
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setMessages(list);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
      (error: any) => {
        if (error?.code === "permission-denied") {
          Alert.alert("Unavailable", "You do not have permission to open this chat.");
          navigation.goBack();
          return;
        }
        Alert.alert("Error", error?.message || "Failed to load chat messages.");
      }
    );
    return unsubscribe;
  }, [conversationId, navigation]);

  useEffect(() => {
    if (!requestId) return;
    const unsubscribe = onSnapshot(doc(db, "requests", requestId), (docSnap) => {
      if (docSnap.exists()) {
        setRequestContext({ id: docSnap.id, ...docSnap.data() });
      } else {
        setRequestContext(null);
      }
    });
    return unsubscribe;
  }, [requestId]);

  // Mark conversation's last message as read when screen is focused
  useEffect(() => {
    const markConversationAsRead = async () => {
      if (!userId || !otherUserId) return;
      try {
        const convRef = doc(db, "conversations", conversationId);
        const convSnap = await getDoc(convRef);
        const convData = convSnap.data();
        const lastMessage = convData?.lastMessage;
        if (
          lastMessage &&
          lastMessage.senderId !== userId &&
          (!lastMessage.readBy || !lastMessage.readBy.includes(userId))
        ) {
          await updateDoc(convRef, {
            "lastMessage.readBy": arrayUnion(userId),
          });
        }
      } catch (error) {
        console.error("markConversationAsRead error:", error);
      }
    };
    markConversationAsRead();
  }, [conversationId, userId, otherUserId]);

  // Mark messages as read (individual message read receipts)
  useEffect(() => {
    const markAsRead = async () => {
      if (!userId || !otherUserId) return;
      try {
        const unreadMessages = messages.filter(
          (msg) =>
            msg.senderId === otherUserId &&
            (!msg.readBy || !msg.readBy.includes(userId))
        );

        if (unreadMessages.length === 0) return;

        const batch = writeBatch(db);
        unreadMessages.forEach((msg) => {
          const msgRef = doc(db, "conversations", conversationId, "messages", msg.id);
          batch.update(msgRef, {
            readBy: arrayUnion(userId),
          });
        });
        await batch.commit();
      } catch (error) {
        const firebaseError = error as any;
        if (firebaseError?.code === "permission-denied") {
          // Read receipts are best-effort; avoid noisy console errors for restricted rules.
          return;
        }
        console.warn("markAsRead messages warning:", firebaseError?.message || error);
      }
    };

    markAsRead();
  }, [messages, userId, otherUserId, conversationId]);

  // If this conversation came from support notifications, mark them as read too.
  useEffect(() => {
    const markSupportNotificationsAsRead = async () => {
      if (!userId || !conversationId) return;

      try {
        const q = query(
          collection(db, "notifications"),
          where("userId", "==", userId),
          where("type", "==", "support_message")
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) return;

        const batch = writeBatch(db);
        let hasUpdates = false;

        snapshot.docs.forEach((notificationDoc) => {
          const notificationData = notificationDoc.data();
          if (
            !notificationData?.read &&
            notificationData?.data?.conversationId === conversationId
          ) {
            batch.update(notificationDoc.ref, { read: true });
            hasUpdates = true;
          }
        });

        if (hasUpdates) {
          await batch.commit();
        }
      } catch (error) {
        console.error("Failed to sync support notification read state:", error);
      }
    };

    markSupportNotificationsAsRead();
  }, [conversationId, userId]);

  // Keep list pinned while typing
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardVisible(true);
      flatListRef.current?.scrollToEnd({ animated: true });
    });
    const keyboardDidHideListener = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardVisible(false);
      flatListRef.current?.scrollToEnd({ animated: true });
    });
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const getSenderName = (senderId: string) => {
    if (senderId === userId) return "You";
    if (senderId === otherUserId) return otherUserName;
    return "User";
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    if (blockState.blockedByMe) {
      Alert.alert("Blocked", "You blocked this user. Unblock first to send messages.");
      return;
    }
    if (blockState.blockedMe) {
      Alert.alert("Unavailable", "You cannot send messages to this user right now.");
      return;
    }
    try {
      const messageData: any = {
        senderId: userId,
        text: inputText.trim(),
        timestamp: serverTimestamp(),
        readBy: [userId],
      };
      if (replyTo) {
        messageData.replyTo = replyTo.id;
        messageData.replyToText = replyTo.text;
        messageData.replyToSenderId = replyTo.senderId;
      }
      await addDoc(collection(db, "conversations", conversationId, "messages"), messageData);
      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: {
          text: inputText.trim(),
          senderId: userId,
          timestamp: serverTimestamp(),
          readBy: [userId],
        },
        hiddenFor: arrayRemove(userId, otherUserId),
        updatedAt: serverTimestamp(),
      });
      setInputText("");
      setReplyTo(null);
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      console.error(error);
    }
  };

  const handlePhotoPress = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const label = asset.fileName || "photo";
      setInputText((prev) =>
        prev?.trim()
          ? `${prev} [Photo: ${label}]`
          : `[Photo: ${label}]`
      );
    } catch {
      Alert.alert("Error", "Failed to pick photo.");
    }
  };

  const acceptRequestFromChat = async () => {
    if (role === "admin") {
      Alert.alert("Unavailable", "Admins cannot accept blood requests.");
      return;
    }
    const user = auth.currentUser;
    if (!user || !requestId || !requestContext) return;

    if (requestContext.requesterId === user.uid) {
      Alert.alert("Cannot accept", "You cannot accept your own request.");
      return;
    }
    if (requestContext.status !== "pending") {
      Alert.alert("Unavailable", "This request is no longer pending.");
      return;
    }

    const eligibility = await ensureDonorCanAcceptRequest({
      db,
      userId: user.uid,
    });
    if (!eligibility.ok) {
      showDialog({
        title: eligibility.title,
        message: eligibility.message,
        tone: "warning",
        actions: [
          { label: "Close", mode: "text" },
          ...(eligibility.actionKind === "open_profile"
            ? [
                {
                  label: eligibility.actionLabel || "Open Profile",
                  mode: "contained" as const,
                  onPress: () => navigation.navigate("Profile"),
                },
              ]
            : []),
        ],
      });
      return;
    }

    showDialog({
      title: "Accept This Request?",
      message: "This will mark the request as accepted, notify the requester, and send an automatic chat message here.",
      tone: "success",
      actions: [
        { label: "Cancel", mode: "text" },
        {
          label: "Yes, Accept",
          mode: "contained",
          onPress: async () => {
      setAcceptingRequest(true);
      try {
        const requestRef = doc(db, "requests", requestId);
        const latestRequestSnap = await getDoc(requestRef);
        const latestRequest = latestRequestSnap.data();

        if (!latestRequestSnap.exists()) {
          Alert.alert("Error", "This request no longer exists.");
          return;
        }

        if (latestRequest?.status !== "pending") {
          showDialog({
            title: "Request Unavailable",
            message: "This request is no longer pending.",
            tone: "warning",
          });
          return;
        }

        const donorName =
          eligibility.userData?.fullName ||
          user.displayName ||
          "A verified donor";
        const autoMessage = `Hi, I accepted your blood request for ${latestRequest.patientName || "the patient"}. We can coordinate everything here in chat.`;

        await updateDoc(requestRef, {
          status: "accepted",
          acceptedBy: user.uid,
          acceptedAt: new Date(),
        });
        await syncPublicCityAvailability(db);

        await addDoc(collection(db, "notifications"), {
          userId: latestRequest.requesterId,
          type: "request_accepted",
          title: "A Donor Accepted Your Request",
          body: `${donorName} accepted your request for ${latestRequest.patientName || "your patient"}. Open chat to coordinate the next steps.`,
          data: { requestId },
          read: false,
          createdAt: serverTimestamp(),
        });

        const convId = getConversationId(user.uid, latestRequest.requesterId);
        const convRef = doc(db, "conversations", convId);
        const convSnap = await getDoc(convRef);
        if (!convSnap.exists()) {
          await setDoc(convRef, {
            participants: [user.uid, latestRequest.requesterId],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        await addDoc(collection(db, "conversations", convId, "messages"), {
          senderId: user.uid,
          text: autoMessage,
          timestamp: serverTimestamp(),
          readBy: [user.uid],
          requestId,
          systemGenerated: true,
        });

        await updateDoc(convRef, {
          lastMessage: {
            text: autoMessage,
            senderId: user.uid,
            timestamp: serverTimestamp(),
            readBy: [user.uid],
          },
          hiddenFor: arrayRemove(user.uid, latestRequest.requesterId),
          updatedAt: serverTimestamp(),
        });

        showDialog({
          title: "Request Accepted",
          message: "The requester has been notified, and the first coordination message was sent automatically.",
          tone: "success",
        });
      } catch (error: any) {
        showDialog({
          title: "Accept Failed",
          message: error?.message || "Failed to accept request.",
          tone: "danger",
        });
      } finally {
        setAcceptingRequest(false);
      }
          },
        },
      ],
    });
  };

  const syncConversationLastMessage = async () => {
    try {
      const latestMessageQuery = query(
        collection(db, "conversations", conversationId, "messages"),
        orderBy("timestamp", "desc"),
        limit(1)
      );
      const latestMessageSnapshot = await getDocs(latestMessageQuery);
      const conversationRef = doc(db, "conversations", conversationId);

      if (latestMessageSnapshot.empty) {
        await updateDoc(conversationRef, {
          lastMessage: null,
          updatedAt: serverTimestamp(),
        });
        return;
      }

      const latest = latestMessageSnapshot.docs[0].data();
      await updateDoc(conversationRef, {
        lastMessage: {
          text: latest.text || "",
          senderId: latest.senderId || null,
          timestamp: latest.timestamp || serverTimestamp(),
          readBy: latest.readBy || [],
        },
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn("syncConversationLastMessage warning:", error);
    }
  };

  const handleLongPress = (message: any) => {
    const ref = messageRefs.current[message.id];
    if (ref) {
      ref.measure((x, y, width, height, pageX, pageY) => {
        const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
        const menuWidth = 200;
        const menuHeight = 120;

        let xPos = pageX + width / 2 - menuWidth / 2;
        xPos = Math.max(10, Math.min(xPos, screenWidth - menuWidth - 10));

        let yPos = pageY + height + 5;
        if (yPos + menuHeight > screenHeight - 20) {
          yPos = pageY - menuHeight - 5;
        }
        if (yPos < 20) {
          yPos = pageY + height + 5;
        }

        setMenuPosition({ x: xPos, y: yPos });
        setSelectedMessage(message);
        setMenuVisible(true);
      });
    } else {
      setSelectedMessage(message);
      setMenuVisible(true);
    }
  };

  const closeMenu = () => {
    setMenuVisible(false);
    setSelectedMessage(null);
  };

  const handleReply = () => {
    if (selectedMessage) {
      setReplyTo(selectedMessage);
      closeMenu();
    }
  };

  const handleReact = (emoji: string) => {
    if (!selectedMessage || !userId) return;
    const messageRef = doc(db, "conversations", conversationId, "messages", selectedMessage.id);
    const currentReactions = selectedMessage.reactions || {};

    let newReactions = { ...currentReactions };
    if (newReactions[userId] === emoji) {
      delete newReactions[userId];
    } else {
      newReactions[userId] = emoji;
    }

    if (Object.keys(newReactions).length === 0) {
      updateDoc(messageRef, { reactions: null }).catch(console.error);
    } else {
      updateDoc(messageRef, { reactions: newReactions }).catch(console.error);
    }
    closeMenu();
  };

  const openEditModal = () => {
    if (selectedMessage) {
      setEditingMessage(selectedMessage);
      setEditText(selectedMessage.text);
      setEditModalVisible(true);
      closeMenu();
    }
  };

  const confirmDelete = () => {
    if (!selectedMessage) return;
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" as const },
        {
          text: "Delete",
          style: "destructive" as const,
          onPress: () => deleteMessage(selectedMessage.id),
        },
      ]
    );
    closeMenu();
  };

  const deleteMessage = async (messageId: string) => {
    try {
      await deleteDoc(doc(db, "conversations", conversationId, "messages", messageId));
      await syncConversationLastMessage();
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to delete message.");
    }
  };

  const saveEditedMessage = async () => {
    if (!editText.trim() || !editingMessage) return;
    try {
      await updateDoc(doc(db, "conversations", conversationId, "messages", editingMessage.id), {
        text: editText.trim(),
        editedAt: serverTimestamp(),
      });
      await syncConversationLastMessage();
      setEditModalVisible(false);
      setEditingMessage(null);
      setEditText("");
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to edit message.");
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isMe = item.senderId === userId;
    const hasReply = !!item.replyToText;
    const senderName = getSenderName(item.senderId);
    const replyToName = item.replyToSenderId ? getSenderName(item.replyToSenderId) : "someone";

    const reactions = item.reactions ? Object.values(item.reactions) : [];

    // Read status: true if the other user has read the message
    const isRead = item.readBy?.includes(otherUserId) || false;

    return (
      <TouchableOpacity
        ref={(ref) => {
          if (ref) messageRefs.current[item.id] = ref;
          else delete messageRefs.current[item.id];
        }}
        activeOpacity={0.7}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={500}
      >
        <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
          <View style={styles.messageContainer}>
            {!isMe && (
              <View style={styles.senderInfo}>
                {String(otherUserRole).toLowerCase() === "admin" ? (
                  <Avatar.Image size={24} source={APP_LOGO} style={styles.avatar} />
                ) : otherUserPhoto ? (
                  <Avatar.Image size={24} source={{ uri: otherUserPhoto }} style={styles.avatar} />
                ) : (
                  <Avatar.Image size={24} source={getDefaultProfileImage(otherUserGender)} style={styles.avatar} />
                )}
                <Text style={styles.senderName}>{senderName}</Text>
              </View>
            )}
            {hasReply && (
              <View style={[styles.replyPreviewContainer, isMe ? styles.myReplyPreview : styles.otherReplyPreview]}>
                <Card style={styles.replyBubble}>
                  <Card.Content>
                    <Text style={styles.replyLabel}>
                      Replied to {replyToName}
                    </Text>
                    <Text style={styles.replyText}>{item.replyToText.substring(0, 80)}</Text>
                  </Card.Content>
                </Card>
                <View style={[styles.connector, isMe ? styles.myConnector : styles.otherConnector]} />
              </View>
            )}
            <View>
              <Card style={[styles.messageBubble, isMe ? styles.myBubble : styles.otherBubble]}>
                <Card.Content>
                  <Text variant="bodyMedium" style={isMe ? styles.myText : styles.otherText}>
                    {item.text}
                  </Text>
                  {item.editedAt && (
                    <Text variant="labelSmall" style={styles.editedLabel}>
                      (edited)
                    </Text>
                  )}
                  <View style={styles.messageFooter}>
                    <Text variant="labelSmall" style={styles.timestamp}>
                      {item.timestamp?.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                    {isMe && (
                      <View style={styles.readStatus}>
                        {isRead ? (
                          <Ionicons name="checkmark-done-circle" size={14} color="#4caf50" />
                        ) : (
                          <Ionicons name="checkmark-done" size={14} color="#aaa" />
                        )}
                      </View>
                    )}
                  </View>
                </Card.Content>
              </Card>
              {reactions.length > 0 && (
                <View style={[styles.reactionsContainer, isMe ? styles.myReactions : styles.otherReactions]}>
                  {reactions.map((emoji, idx) => (
                    <Text key={idx} style={styles.reactionEmoji}>{emoji as string}</Text>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const isOwnMessage = selectedMessage?.senderId === userId;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f5f5f5" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
      <View style={[styles.container, isDesktop && styles.containerDesktop]}>
        {blockState.blockedEitherWay && (
          <View style={styles.blockedBanner}>
            <Text style={styles.blockedBannerText}>
              {blockState.blockedByMe
                ? "You blocked this user. Unblock from the shield button to chat again."
                : "This user is unavailable for messaging right now."}
            </Text>
          </View>
        )}
        {!!requestContext &&
          requestContext.status === "pending" &&
          requestContext.requesterId !== userId &&
          !blockState.blockedEitherWay &&
          role !== "admin" && (
            <View style={styles.requestActionBar}>
              <Button
                title={acceptingRequest ? "Accepting..." : "Accept Request"}
                onPress={acceptRequestFromChat}
                disabled={acceptingRequest}
                color="#2e7d32"
              />
            </View>
          )}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.messagesList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        {replyTo && (
          <View style={styles.replyBar}>
            <Text style={styles.replyBarText}>Replying to {getSenderName(replyTo.senderId)}: {replyTo.text.substring(0, 40)}...</Text>
            <IconButton icon="close" size={20} onPress={() => setReplyTo(null)} />
          </View>
        )}
        <View
          style={[
            styles.inputContainer,
            {
              paddingBottom: Math.max(insets.bottom, 2),
              marginBottom: Platform.OS === "android" && keyboardVisible ? 40 : 0,
            },
          ]}
        >
          <IconButton
            icon="image-outline"
            size={22}
            onPress={handlePhotoPress}
            iconColor="#555"
            style={styles.attachButton}
          />
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder={blockState.blockedEitherWay ? "Messaging disabled for this conversation" : "Type a message..."}
            placeholderTextColor="#888"
            multiline
            editable={!blockState.blockedEitherWay}
          />
          <IconButton
            icon="send"
            size={24}
            iconColor={theme.colors.primary}
            onPress={sendMessage}
            disabled={!inputText.trim() || blockState.blockedEitherWay}
          />
        </View>
      </View>
      </KeyboardAvoidingView>

      <Modal visible={safetySheetVisible} transparent animationType="fade" onRequestClose={() => setSafetySheetVisible(false)}>
        <TouchableOpacity style={styles.safetyOverlay} activeOpacity={1} onPress={() => setSafetySheetVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.safetySheet}>
            <Text style={styles.safetyTitle}>Safety Tools</Text>
            <Text style={styles.safetySubtitle}>Manage this conversation securely. Reports are reviewed by admin moderation.</Text>

            <TouchableOpacity style={styles.safetyPrimaryBtn} onPress={submitReportFromSafetyTools}>
              <Text style={styles.safetyPrimaryText}>Report User</Text>
            </TouchableOpacity>

            {String(otherUserRole).toLowerCase() !== "admin" ? (
              <TouchableOpacity
                style={[styles.safetyOutlineBtn, blockState.blockedByMe && styles.safetyOutlineBtnMuted]}
                onPress={handleBlockToggleFromSafetyTools}
              >
                <Text style={[styles.safetyOutlineText, blockState.blockedByMe && styles.safetyOutlineTextMuted]}>
                  {blockState.blockedByMe ? "Unblock User" : "Block User"}
                </Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.safetyBackBtn} onPress={() => setSafetySheetVisible(false)}>
              <Text style={styles.safetyBackText}>Back</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Custom Message Options Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeMenu}
        >
          <View
            style={[
              styles.menuContainer,
              {
                position: "absolute",
                left: menuPosition.x,
                top: menuPosition.y,
              },
            ]}
          >
            <View style={styles.emojiRow}>
              {EMOJIS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => handleReact(emoji)}
                  style={styles.emojiButton}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={handleReply} style={styles.actionButton}>
                <Text style={styles.actionText}>Reply</Text>
              </TouchableOpacity>
              {isOwnMessage && (
                <>
                  <TouchableOpacity onPress={openEditModal} style={styles.actionButton}>
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmDelete} style={styles.actionButton}>
                    <Text style={[styles.actionText, { color: "red" }]}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Message</Text>
            <TextInput
              style={styles.editInput}
              value={editText}
              onChangeText={setEditText}
              multiline
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Button title="Cancel" onPress={() => setEditModalVisible(false)} />
              <Button title="Save" onPress={saveEditedMessage} />
            </View>
          </View>
        </View>
      </Modal>
      {dialog}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  messagesList: {
    padding: 10,
    paddingBottom: 20,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  messageRow: {
    marginVertical: 4,
    flexDirection: "row",
  },
  myMessageRow: {
    justifyContent: "flex-end",
  },
  otherMessageRow: {
    justifyContent: "flex-start",
  },
  messageContainer: {
    maxWidth: "70%",
    position: "relative",
  },
  senderInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
    marginLeft: 8,
  },
  avatar: {
    marginRight: 4,
  },
  senderName: {
    fontSize: 12,
    color: "#666",
  },
  messageBubble: {
    backgroundColor: "#fff",
  },
  myBubble: {
    backgroundColor: "#d32f2f",
  },
  otherBubble: {
    backgroundColor: "#e0e0e0",
  },
  myText: {
    color: "white",
  },
  otherText: {
    color: "black",
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  timestamp: {
    fontSize: 10,
    color: "#999",
  },
  readStatus: {
    marginLeft: 4,
  },
  editedLabel: {
    fontSize: 9,
    color: "#aaa",
    marginRight: 4,
    alignSelf: "flex-end",
  },
  reactionsContainer: {
    position: "absolute",
    bottom: -12,
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    borderWidth: 0.5,
    borderColor: "#ddd",
  },
  myReactions: {
    right: 0,
  },
  otherReactions: {
    left: 0,
  },
  reactionEmoji: {
    fontSize: 14,
    marginHorizontal: 2,
  },
  replyPreviewContainer: {
    marginBottom: 4,
    alignItems: "flex-start",
    position: "relative",
  },
  myReplyPreview: {
    alignItems: "flex-end",
  },
  otherReplyPreview: {
    alignItems: "flex-start",
  },
  replyBubble: {
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    maxWidth: "100%",
    marginBottom: 2,
    padding: 0,
  },
  replyLabel: {
    fontSize: 10,
    color: "#666",
    marginBottom: 2,
  },
  replyText: {
    fontSize: 12,
    color: "#333",
  },
  connector: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -4,
  },
  myConnector: {
    borderTopColor: "#d32f2f",
    alignSelf: "flex-end",
    marginRight: 20,
  },
  otherConnector: {
    borderTopColor: "#e0e0e0",
    alignSelf: "flex-start",
    marginLeft: 20,
  },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#e0e0e0",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  replyBarText: {
    fontSize: 12,
    color: "#333",
    flex: 1,
  },
  blockedBanner: {
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  blockedBannerText: {
    color: "#9f1239",
    fontWeight: "700",
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#ddd",
    alignItems: "center",
  },
  attachButton: {
    margin: 0,
    marginRight: 2,
  },
  requestActionBar: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    maxHeight: 100,
    backgroundColor: "#fafafa",
    fontSize: 16,
  },
  containerDesktop: {
    maxWidth: 800,
    alignSelf: "center",
    width: "100%",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 8,
  },
  backButton: {
    marginRight: 12,
  },
  headerModerationButton: {
    marginRight: 12,
  },
  headerActionsWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 4,
  },
  headerProfile: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTextWrap: {
    marginLeft: 8,
  },
  headerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  headerProfileHint: {
    marginTop: 1,
    fontSize: 11,
    color: "#fee2e2",
    fontWeight: "700",
  },
  safetyOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  safetySheet: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#fee2e2",
    shadowColor: "#111827",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  safetyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#b91c1c",
  },
  safetySubtitle: {
    marginTop: 4,
    color: "#6b7280",
    marginBottom: 14,
  },
  safetyPrimaryBtn: {
    backgroundColor: "#dc2626",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  safetyPrimaryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  safetyOutlineBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fca5a5",
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 10,
    backgroundColor: "#fff7f7",
  },
  safetyOutlineBtnMuted: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },
  safetyOutlineText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  safetyOutlineTextMuted: {
    color: "#15803d",
  },
  safetyBackBtn: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  safetyBackText: {
    color: "#374151",
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  menuContainer: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 200,
  },
  emojiRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 8,
  },
  emojiButton: {
    padding: 8,
  },
  emojiText: {
    fontSize: 24,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
  },
  actionText: {
    fontSize: 16,
    color: "#d32f2f",
    fontWeight: "500",
  },
  modalContent: {
    width: "80%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
  },
  editInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
});

