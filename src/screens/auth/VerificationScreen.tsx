import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, Button, Alert, StyleSheet } from "react-native";
import { sendEmailVerification } from "firebase/auth";
import { useAuth } from "../../context/AuthContext";
import { useResponsive } from "../../utils/responsive";

export default function VerificationScreen() {
  const { user, logout } = useAuth();
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const { isDesktop } = useResponsive();
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const handleAutoLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Auto logout failed:", error);
    }
  }, [logout]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [handleAutoLogout]);

  const resendVerification = async () => {
    if (!user) return;
    setResending(true);
    try {
      await sendEmailVerification(user);
      Alert.alert("Verification Email Sent", "Please check your inbox.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      if (mounted.current) setResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error: any) {
      Alert.alert("Logout Failed", error.message);
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, isDesktop && styles.cardDesktop]}>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.message}>
          We have sent a verification email to {"\n"}
          <Text style={styles.email}>{user?.email}</Text>
        </Text>
        <Text style={styles.countdown}>
          Redirecting to login in {countdown} seconds...
        </Text>
        <Button
          title={resending ? "Sending..." : "Resend Verification Email"}
          onPress={resendVerification}
          disabled={resending}
        />
        <View style={{ marginTop: 10 }} />
        <Button title="Logout Now" onPress={handleLogout} color="red" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  cardDesktop: {
    maxWidth: 500,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#d32f2f",
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  email: {
    fontWeight: "600",
    color: "#d32f2f",
  },
  countdown: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    fontStyle: "italic",
    textAlign: "center",
  },
});

