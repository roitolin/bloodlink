import { useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  Image,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  findNodeHandle,
} from "react-native";
import { Button as PaperButton } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";
import { useAppDialog } from "../../hooks/useAppDialog";

export default function ForgotPasswordScreen({ navigation, route }: any) {
  const [email, setEmail] = useState(route.params?.email || "");
  const [loading, setLoading] = useState(false);
  const { isDesktop } = useResponsive();
  const scrollRef = useRef<ScrollView>(null);
  const emailRef = useRef<TextInput>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const { showDialog, dialog } = useAppDialog();

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const scrollToInput = (inputRef: any) => {
    const inputHandle = findNodeHandle(inputRef.current);
    if (!inputHandle) return;
    (scrollRef.current as any)?.scrollResponderScrollNativeHandleToKeyboard(inputHandle, 120, true);
  };

  const getResetErrorMessage = (error: any) => {
    const code = error?.code || "";

    if (code === "auth/invalid-email") {
      return "Please enter a valid email address.";
    }
    if (code === "auth/user-not-found") {
      return "No account was found for that email address.";
    }
    if (code === "auth/too-many-requests") {
      return "Too many reset attempts. Please wait a moment and try again.";
    }
    if (code === "auth/network-request-failed") {
      return "Network error. Please check your internet connection.";
    }
    return "Unable to send the reset email right now. Please try again.";
  };

  const handleResetPassword = async () => {
    if (!email.trim()) {
      showDialog({
        title: "Email Required",
        message: "Please enter your email address first.",
        tone: "warning",
      });
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      showDialog({
        title: "Reset Email Sent",
        message: `We sent a password reset link to ${email.trim()}. Check your inbox and spam folder, then come back once you've updated your password.`,
        tone: "success",
        actions: [
          {
            label: "Back to Login",
            mode: "contained",
            onPress: () => navigation.navigate("Login", { email: email.trim() }),
          },
        ],
      });
    } catch (error: any) {
      showDialog({
        title: "Reset Failed",
        message: getResetErrorMessage(error),
        tone: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
    >
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.authWrap, isDesktop && styles.authWrapDesktop]}>
          {isDesktop && (
            <Animated.View
              style={[
                styles.introCard,
                {
                  opacity: entrance,
                  transform: [
                    {
                      translateY: entrance.interpolate({
                        inputRange: [0, 1],
                        outputRange: [18, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.introKicker}>Account Access</Text>
              <Text style={styles.introTitle}>Reset Your Password</Text>
              <Text style={styles.introBody}>Reset your password, then sign in again to continue to LifeCycle.</Text>
            </Animated.View>
          )}

          <Animated.View
            style={[
              styles.container,
              isDesktop && styles.containerDesktop,
              {
                opacity: entrance,
                transform: [
                  {
                    translateY: entrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [28, 0],
                    }),
                  },
                  {
                    scale: entrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <TouchableOpacity style={styles.backRow} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={18} color="#b91c1c" />
              <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>

            <Image source={require("../../../assets/Logo.png")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Forgot Password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we&apos;ll send a reset link so you can create a new password.
            </Text>

            <TextInput
              ref={emailRef}
              placeholder="Email"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              onFocus={() => scrollToInput(emailRef)}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              importantForAutofill="yes"
              returnKeyType="done"
              onSubmitEditing={handleResetPassword}
              style={styles.input}
            />

            <PaperButton
              mode="contained"
              loading={loading}
              disabled={loading}
              onPress={handleResetPassword}
              style={styles.primaryButton}
              contentStyle={styles.primaryButtonContent}
              labelStyle={styles.primaryButtonLabel}
              buttonColor="#d32f2f"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </PaperButton>

            <TouchableOpacity onPress={() => navigation.navigate("Login", { email: email.trim() })} style={styles.linkWrap}>
              <Text style={styles.link}>Remembered it? Back to login</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </ScrollView>
      {dialog}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff7f7" },
  glowTop: {
    position: "absolute",
    top: -140,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: "#ffe1e1",
  },
  glowBottom: {
    position: "absolute",
    right: -110,
    bottom: 30,
    width: 320,
    height: 320,
    borderRadius: 999,
    backgroundColor: "#ffd4d4",
  },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 20 },
  authWrap: { width: "100%" },
  authWrapDesktop: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 18,
    maxWidth: 1080,
    width: "100%",
    alignSelf: "center",
  },
  container: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: "#ffe4e6",
    shadowColor: "#ef4444",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginBottom: 12,
  },
  backText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  logo: {
    width: 104,
    height: 104,
    alignSelf: "center",
    marginBottom: 8,
  },
  title: { fontSize: 38, fontWeight: "800", textAlign: "center", marginBottom: 6, color: "#c62828" },
  subtitle: {
    fontSize: 15,
    textAlign: "center",
    color: "#6b7280",
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: "#fbcaca",
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 13,
    backgroundColor: "#fffafa",
    color: "#1f2937",
    fontSize: 16,
  },
  primaryButton: {
    borderRadius: 999,
    marginTop: 8,
    shadowColor: "#ef4444",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  primaryButtonContent: {
    paddingVertical: 10,
  },
  primaryButtonLabel: {
    fontWeight: "800",
    fontSize: 18,
    lineHeight: 24,
    includeFontPadding: false,
  },
  linkWrap: {
    marginTop: 14,
  },
  link: { color: "#d32f2f", textAlign: "center", fontWeight: "700", fontSize: 15 },
  containerDesktop: {
    maxWidth: 440,
    width: "100%",
    alignSelf: "center",
  },
  introCard: {
    flex: 1,
    backgroundColor: "#fff1f2",
    borderRadius: 28,
    padding: 28,
    borderWidth: 1,
    borderColor: "#fecaca",
    justifyContent: "center",
  },
  introKicker: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  introTitle: {
    color: "#b91c1c",
    fontSize: 34,
    fontWeight: "800",
    marginBottom: 10,
  },
  introBody: {
    color: "#7f1d1d",
    fontSize: 17,
    lineHeight: 25,
    maxWidth: 420,
  },
});

