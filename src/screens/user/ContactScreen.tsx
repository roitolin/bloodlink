import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  ScrollView,
  Linking,
  TouchableOpacity,
} from "react-native";
import { Dialog, Portal, Button as PaperButton } from "react-native-paper";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../../services/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useResponsive } from "../../utils/responsive";
import { ensureConversationForUsers } from "../../utils/chatHelpers";
import { consumeRateLimit, isRateLimitError } from "../../utils/rateLimiter";
import { hasSuspiciousPayload, sanitizePlainText } from "../../utils/inputSecurity";
import { getAdminId } from "../../utils/adminConfig";

const SUPPORT_PHONE = "+639123456789";
const isPermissionDeniedError = (error: any) =>
  error?.code === "permission-denied" ||
  /missing or insufficient permissions/i.test(String(error?.message || ""));

export default function ContactScreen({ navigation }: any) {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [successDialogVisible, setSuccessDialogVisible] = useState(false);
  const { isDesktop } = useResponsive();

  const ensureSupportConversation = async () => {
    if (!user?.uid) {
      throw new Error("Please log in again before contacting support.");
    }
    const adminUserId = await getAdminId({
      excludeUserId: user.uid,
      allowExcludedFallback: true,
    });
    if (!adminUserId) {
      throw new Error("Support chat is unavailable because no admin support account is configured yet.");
    }

    const conversationId = await ensureConversationForUsers(db, user.uid, adminUserId);
    const convRef = doc(db, "conversations", conversationId);

    return { conversationId, convRef, adminUserId };
  };

  const handleCall = async () => {
    const url = `tel:${SUPPORT_PHONE.replace(/\s+/g, "")}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unavailable", "Calling is not available on this device.");
    }
  };

  const handleSms = async () => {
    const url = `sms:${SUPPORT_PHONE.replace(/\s+/g, "")}?body=${encodeURIComponent(
      "Hello Support Team, I need help with LifeCycle."
    )}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unavailable", "SMS is not available on this device.");
    }
  };

  const handleOpenChat = async () => {
    try {
      const { conversationId, adminUserId } = await ensureSupportConversation();
      navigation.navigate("SupportChat", {
        conversationId,
        otherUserId: adminUserId,
      });
    } catch (error: any) {
      if (isPermissionDeniedError(error)) {
        Alert.alert(
          "Support Chat Unavailable",
          "Live chat is temporarily unavailable because your account could not open the assigned support conversation. You can still send your concern below and our support team will receive it."
        );
        return;
      }
      Alert.alert("Error", error?.message || "Failed to open support chat.");
    }
  };

  const handleSubmit = async () => {
    if (!user?.uid) {
      Alert.alert("Session Ended", "Please log in again before sending a support message.");
      return;
    }

    const safeSubject = sanitizePlainText(subject, 120);
    const safeMessage = sanitizePlainText(message, 1200);

    if (!safeSubject || !safeMessage) {
      Alert.alert("Error", "Please fill in both subject and message.");
      return;
    }
    if (hasSuspiciousPayload(safeSubject) || hasSuspiciousPayload(safeMessage)) {
      Alert.alert("Blocked", "Your message contains unsafe text patterns. Please revise and try again.");
      return;
    }

    setLoading(true);
    try {
      await consumeRateLimit(db, user.uid, "support_message");

      const { conversationId, convRef, adminUserId } = await ensureSupportConversation();
      const messageText = `${safeSubject}\n\n${safeMessage}`;
      const previewText = `${safeSubject}: ${safeMessage.substring(0, 50)}${safeMessage.length > 50 ? "..." : ""}`;
      const notificationBody = `${safeSubject}: ${safeMessage.substring(0, 100)}${safeMessage.length > 100 ? "..." : ""}`;

      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        senderId: user.uid,
        text: messageText,
        timestamp: serverTimestamp(),
        readBy: [user.uid],
      });

      const settled = await Promise.allSettled([
        updateDoc(convRef, {
          lastMessage: {
            text: previewText,
            senderId: user.uid,
            timestamp: serverTimestamp(),
            readBy: [user.uid],
          },
          hiddenFor: arrayRemove(user.uid, adminUserId),
          updatedAt: serverTimestamp(),
        }),
        addDoc(collection(db, "notifications"), {
          userId: adminUserId,
          type: "support_message",
          title: `New Support Message from ${user?.email}`,
          body: notificationBody,
          read: false,
          createdAt: serverTimestamp(),
          data: { conversationId, otherUserId: user.uid },
        }),
      ]);

      settled.forEach((result) => {
        if (result.status === "rejected" && !isPermissionDeniedError(result.reason)) {
          console.warn("Support follow-up write failed:", result.reason);
        }
      });

      setSubject("");
      setMessage("");
      setSuccessDialogVisible(true);
    } catch (error: any) {
      if (isRateLimitError(error)) {
        Alert.alert("Slow down", `Please wait ${error.retryAfterSeconds}s before sending another support message.`);
        return;
      }

      if (isPermissionDeniedError(error)) {
        try {
          await addDoc(collection(db, "supportMessages"), {
            userId: user.uid,
            email: user.email || null,
            subject: safeSubject,
            message: safeMessage,
            read: false,
            status: "open",
            createdAt: serverTimestamp(),
            channel: "contact_fallback",
          });
          setSubject("");
          setMessage("");
          Alert.alert(
            "Message Sent",
            "Your message was sent via fallback support channel. Our team will still receive and review it."
          );
          return;
        } catch (fallbackError: any) {
          console.error("Fallback support message failed:", fallbackError);
        }
      }

      Alert.alert("Error", "Unable to send your support message right now. Please try again shortly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
      <Text style={styles.title}>Contact Support</Text>
      <Text style={styles.subtitle}>
        Have a question, suggestion, or issue? Let us know and we&apos;ll get back to you.
      </Text>

      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickButton} onPress={handleCall} activeOpacity={0.85}>
          <Text style={styles.quickButtonText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickButton} onPress={handleSms} activeOpacity={0.85}>
          <Text style={styles.quickButtonText}>SMS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickButton} onPress={handleOpenChat} activeOpacity={0.85}>
          <Text style={styles.quickButtonText}>Chat</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>Subject</Text>
      <TextInput
        style={styles.input}
        value={subject}
        onChangeText={setSubject}
        placeholder="Brief subject"
      />

      <Text style={styles.label}>Message</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={message}
        onChangeText={setMessage}
        placeholder="Your message..."
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      <Button title={loading ? "Sending..." : "Send Message"} onPress={handleSubmit} disabled={loading} />

      <Portal>
        <Dialog visible={successDialogVisible} onDismiss={() => setSuccessDialogVisible(false)}>
          <Dialog.Title>Message Sent</Dialog.Title>
          <Dialog.Content>
            <Text>Your support message was sent successfully. The admin team will reply soon.</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <PaperButton onPress={() => setSuccessDialogVisible(false)}>
              Close
            </PaperButton>
            <PaperButton
              onPress={async () => {
                setSuccessDialogVisible(false);
                await handleOpenChat();
              }}
            >
              Open Support Chat
            </PaperButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: "#f5f5f5" },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 10, color: "#d32f2f" },
  subtitle: { fontSize: 16, color: "#666", marginBottom: 14 },
  quickActions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  quickButton: {
    flex: 1,
    backgroundColor: "#d32f2f",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  quickButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  label: { fontSize: 16, fontWeight: "600", marginTop: 15, marginBottom: 5 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  textArea: { minHeight: 120, textAlignVertical: "top" },
  containerDesktop: { maxWidth: 600, alignSelf: "center", width: "100%" },
});

