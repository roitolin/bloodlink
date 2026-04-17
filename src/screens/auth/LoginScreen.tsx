import { useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  Text,
  Image,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  findNodeHandle,
  Linking,
  Modal,
} from "react-native";
import { Button as PaperButton } from "react-native-paper";
import { Ionicons } from "@expo/vector-icons";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useResponsive } from "../../utils/responsive";

export default function LoginScreen({ navigation, route }: any) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [banDialog, setBanDialog] = useState<{ reason: string; banEndsLabel: string } | null>(null);
  const { isDesktop } = useResponsive();
  const scrollRef = useRef<ScrollView>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const supportPhone = "+639123456789";
  const supportEmail = "support@bloodlink.app";
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  useEffect(() => {
    if (route?.params?.email) {
      setEmail(String(route.params.email));
    }
  }, [route?.params?.email]);

  const scrollToInput = (inputRef: any) => {
    const inputHandle = findNodeHandle(inputRef.current);
    if (!inputHandle) return;
    (scrollRef.current as any)?.scrollResponderScrollNativeHandleToKeyboard(inputHandle, 120, true);
  };

  const getLoginErrorMessage = (error: any) => {
    const code = error?.code || "";

    if (code === "auth/invalid-credential" || code === "auth/user-not-found") {
      return "Email not found. Please register this account first.";
    }
    if (code === "auth/wrong-password") {
      return "Incorrect password. Please try again.";
    }
    if (code === "auth/invalid-email") {
      return "Please enter a valid email address.";
    }
    if (code === "auth/user-disabled") {
      return "This account has been disabled.";
    }
    if (code === "auth/too-many-requests") {
      return "Too many attempts. Please wait a moment and try again.";
    }
    if (code === "auth/network-request-failed") {
      return "Network error. Please check your internet connection.";
    }
    return "Unable to log in right now. Please try again.";
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userDocRef = doc(db, "users", credential.user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) return;

      const userData = userDoc.data() as any;
      const disabled = Boolean(userData?.disabled);
      const banReason = String(userData?.banReason || "").trim() || "No reason provided by admin.";
      const bannedUntilRaw = userData?.bannedUntil;
      const bannedUntil =
        typeof bannedUntilRaw?.toDate === "function"
          ? bannedUntilRaw.toDate()
          : bannedUntilRaw
          ? new Date(bannedUntilRaw)
          : null;
      const hasValidBanEnd = bannedUntil instanceof Date && !Number.isNaN(bannedUntil.getTime());

      if (disabled && hasValidBanEnd && bannedUntil.getTime() <= Date.now()) {
        await updateDoc(userDocRef, {
          disabled: false,
          banReason: null,
          bannedBy: null,
          bannedAt: null,
          bannedUntil: null,
        });
        return;
      }

      if (disabled) {
        await signOut(auth);
        setBanDialog({
          reason: banReason,
          banEndsLabel: hasValidBanEnd ? bannedUntil.toLocaleString() : "No end date (permanent)",
        });
      }
    } catch (error: any) {
      Alert.alert("Login Failed", getLoginErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const openSupportChannel = async (channel: "sms" | "email") => {
    const url =
      channel === "sms"
        ? `sms:${supportPhone}?body=${encodeURIComponent("I need help logging in to my BloodLink account.")}`
        : `mailto:${supportEmail}?subject=${encodeURIComponent("BloodLink Login Help")}&body=${encodeURIComponent(
            `I need help logging in.\nEmail: ${email || "(not provided)"}\nIssue: `
          )}`;

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert(
        "Unavailable",
        channel === "sms" ? "SMS is not available on this device." : "Email app is not available on this device."
      );
      return;
    }
    await Linking.openURL(url);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
    >
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />
      <Modal visible={!!banDialog} transparent animationType="fade" onRequestClose={() => setBanDialog(null)}>
        <View style={styles.banOverlay}>
          <View style={styles.banCard}>
            <View style={styles.banIconWrap}>
              <Ionicons name="warning" size={20} color="#b91c1c" />
            </View>
            <Text style={styles.banTitle}>Account Banned</Text>
            <Text style={styles.banSubtitle}>This account is currently restricted by admin moderation.</Text>

            <View style={styles.banSection}>
              <Text style={styles.banLabel}>Reason</Text>
              <Text style={styles.banValue}>{banDialog?.reason || "No reason provided."}</Text>
            </View>

            <View style={styles.banSection}>
              <Text style={styles.banLabel}>Ban Ends</Text>
              <Text style={styles.banValue}>{banDialog?.banEndsLabel || "Not available"}</Text>
            </View>

            <View style={styles.banActions}>
              <TouchableOpacity style={styles.banSecondaryBtn} onPress={() => setBanDialog(null)}>
                <Text style={styles.banSecondaryText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.banPrimaryBtn}
                onPress={async () => {
                  await openSupportChannel("sms");
                }}
              >
                <Text style={styles.banPrimaryText}>Contact Support</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
              <Text style={styles.introKicker}>BloodLink</Text>
              <Text style={styles.introTitle}>Welcome Back</Text>
              <Text style={styles.introBody}>
                Sign in to manage requests, connect with donors, and monitor urgent blood needs in your area.
              </Text>
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
            <Image source={require("../../../assets/Logo.png")} style={styles.logo} resizeMode="contain" />
            <Text style={styles.title}>Log In</Text>
            <Text style={styles.subtitle}>Sign in to continue helping your community.</Text>

            <TextInput
              ref={emailRef}
              placeholder="Email"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              onFocus={() => {
                setEmailFocused(true);
                scrollToInput(emailRef);
              }}
              onBlur={() => setEmailFocused(false)}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              importantForAutofill="yes"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              style={[styles.input, emailFocused && styles.inputFocused]}
            />
            <View style={styles.passwordFieldWrap}>
              <TextInput
                ref={passwordRef}
                placeholder="Password"
                placeholderTextColor="#9ca3af"
                value={password}
                onChangeText={setPassword}
                onFocus={() => {
                  setPasswordFocused(true);
                  scrollToInput(passwordRef);
                }}
                onBlur={() => setPasswordFocused(false)}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                importantForAutofill="yes"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                style={[styles.input, styles.passwordInput, passwordFocused && styles.inputFocused]}
              />
              <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword((prev) => !prev)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={21} color="#d32f2f" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate("ForgotPassword", { email: email.trim() })}
              style={styles.forgotWrap}
            >
              <Text style={styles.forgotLink}>Forgot Password?</Text>
            </TouchableOpacity>

            <PaperButton
              mode="contained"
              loading={loading}
              disabled={loading}
              onPress={handleLogin}
              style={styles.primaryButton}
              contentStyle={styles.primaryButtonContent}
              labelStyle={styles.primaryButtonLabel}
              buttonColor="#d32f2f"
            >
              {loading ? "Logging in..." : "Log in"}
            </PaperButton>

            <TouchableOpacity onPress={() => navigation.navigate("Register")} style={styles.linkWrap}>
              <Text style={styles.link}>Don&apos;t have an account? Sign up</Text>
            </TouchableOpacity>

            <View style={styles.supportWrap}>
              <Text style={styles.supportLabel}>Trouble logging in?</Text>
              <View style={styles.supportActions}>
                <TouchableOpacity style={styles.supportButton} onPress={() => openSupportChannel("sms")}>
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color="#b91c1c" />
                  <Text style={styles.supportButtonText}>Contact Support</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.supportButton} onPress={() => openSupportChannel("email")}>
                  <Ionicons name="mail-outline" size={17} color="#b91c1c" />
                  <Text style={styles.supportButtonText}>Report Login Issue</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
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
  logo: {
    width: 104,
    height: 104,
    alignSelf: "center",
    marginBottom: 8,
  },
  title: { fontSize: 42, fontWeight: "800", textAlign: "center", marginBottom: 6, color: "#c62828" },
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
  inputFocused: {
    borderColor: "#ef4444",
    backgroundColor: "#ffffff",
    shadowColor: "#ef4444",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  passwordFieldWrap: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 46,
  },
  eyeButton: {
    position: "absolute",
    right: 10,
    top: 8,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
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
    fontSize: 20,
    lineHeight: 24,
    includeFontPadding: false,
  },
  linkWrap: {
    marginTop: 14,
  },
  forgotWrap: {
    alignSelf: "flex-end",
    marginTop: -2,
    marginBottom: 6,
  },
  forgotLink: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 14,
  },
  link: { color: "#d32f2f", textAlign: "center", fontWeight: "700", fontSize: 15 },
  supportWrap: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#ffe4e6",
    paddingTop: 12,
  },
  supportLabel: {
    textAlign: "center",
    color: "#6b7280",
    fontWeight: "700",
    marginBottom: 10,
  },
  supportActions: {
    gap: 8,
  },
  supportButton: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff5f5",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  supportButtonText: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 14,
  },
  banOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  banCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  banIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  banTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#b91c1c",
  },
  banSubtitle: {
    marginTop: 3,
    color: "#6b7280",
    marginBottom: 10,
  },
  banSection: {
    borderWidth: 1,
    borderColor: "#fee2e2",
    backgroundColor: "#fff7f7",
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  banLabel: {
    color: "#991b1b",
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 3,
  },
  banValue: {
    color: "#1f2937",
    fontWeight: "600",
  },
  banActions: {
    marginTop: 6,
    flexDirection: "row",
    gap: 8,
  },
  banSecondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  banSecondaryText: {
    color: "#374151",
    fontWeight: "700",
  },
  banPrimaryBtn: {
    flex: 1,
    backgroundColor: "#dc2626",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  banPrimaryText: {
    color: "#fff",
    fontWeight: "800",
  },
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

