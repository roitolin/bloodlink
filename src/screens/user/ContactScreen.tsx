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
  getDoc,
  setDoc,
  updateDoc,
  arrayRemove,
} from "firebase/firestore";
import { db } from "../../services/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useResponsive } from "../../utils/responsive";
import { getConversationId } from "../../utils/chatHelpers";

// Replace with your actual support/admin details.
const ADMIN_UID = "x1Q4PbL1YVU2Qjxyu6fPXpcjh0t2";
const SUPPORT_PHONE = "+639123456789";

export default function ContactScreen({ navigation }: any) {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [successDialogVisible, setSuccessDialogVisible] = useState(false);
  const { isDesktop } = useResponsive();

  const ensureSupportConversation = async () => {
    const conversationId = getConversationId(user!.uid, ADMIN_UID);
    const convRef = doc(db, "conversations", conversationId);
    const convSnap = await getDoc(convRef);

    if (!convSnap.exists()) {
      await setDoc(convRef, {
        participants: [user!.uid, ADMIN_UID],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return { conversationId, convRef };
  };

  const handleCall = async () => {
    const url = `tel:${SUPPORT_PHONE}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("Unavailable", "Calling is not available on this device.");
      return;
    }
    await Linking.openURL(url);
  };

  const handleSms = async () => {
    const url = `sms:${SUPPORT_PHONE}?body=${encodeURIComponent(
      "Hello Support Team, I need help with BloodLink."
    )}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("Unavailable", "SMS is not available on this device.");
      return;
    }
    await Linking.openURL(url);
  };

  const handleOpenChat = async () => {
    try {
      const { conversationId } = await ensureSupportConversation();
      navigation.navigate("SupportChat", {
        conversationId,
        otherUserId: ADMIN_UID,
      });
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to open support chat.");
    }
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert("Error", "Please fill in both subject and message.");
      return;
    }

    setLoading(true);
    try {
      const { conversationId, convRef } = await ensureSupportConversation();

      await addDoc(collection(db, "conversations", conversationId, "messages"), {
        senderId: user!.uid,
        text: `${subject}\n\n${message}`,
        timestamp: serverTimestamp(),
      });

      await updateDoc(convRef, {
        lastMessage: {
          text: `${subject}: ${message.substring(0, 50)}${message.length > 50 ? "..." : ""}`,
          senderId: user!.uid,
          timestamp: serverTimestamp(),
        },
        hiddenFor: arrayRemove(user!.uid, ADMIN_UID),
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, "notifications"), {
        userId: ADMIN_UID,
        type: "support_message",
        title: `New Support Message from ${user?.email}`,
        body: `${subject}: ${message.substring(0, 100)}${message.length > 100 ? "..." : ""}`,
        read: false,
        createdAt: serverTimestamp(),
        data: { conversationId, otherUserId: user!.uid },
      });

      setSubject("");
      setMessage("");
      setSuccessDialogVisible(true);
    } catch (error: any) {
      Alert.alert("Error", error.message);
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

