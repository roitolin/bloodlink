import { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { BlurView } from "expo-blur";
import { Button, Checkbox } from "react-native-paper";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useAuth } from "../../context/AuthContext";

export default function TermsAndConditionsScreen() {
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const { refreshUserProfile } = useAuth();

  const handleContinue = async () => {
    if (!accepted) {
      Alert.alert("Required", "Please accept the Terms & Conditions to continue.");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        termsAccepted: true,
        termsAcceptedAt: new Date(),
      });
      await refreshUserProfile();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to save your acceptance.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.fakeBackgroundLayer}>
        <View style={[styles.fakeStrip, { width: "88%" }]} />
        <View style={[styles.fakeStrip, { width: "72%" }]} />
        <View style={[styles.fakeStrip, { width: "80%" }]} />
      </View>

      <BlurView intensity={55} tint="light" style={StyleSheet.absoluteFillObject} />

      <View style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>Terms & Conditions</Text>
            <Text style={styles.updated}>Effective Date: April 2, 2026</Text>

            <Text style={styles.body}>
              By using BloodLink, you agree to provide accurate information, communicate
              respectfully, and use the platform only for legitimate blood donation and support
              purposes.
            </Text>
            <Text style={styles.body}>
              BloodLink connects donors and requesters but does not replace professional medical
              advice. Users should coordinate with licensed health professionals and accredited
              blood centers.
            </Text>
            <Text style={styles.body}>
              You are responsible for your own health disclosures, safety decisions, and compliance
              with local medical regulations.
            </Text>

            <View style={styles.acceptRow}>
              <Checkbox
                status={accepted ? "checked" : "unchecked"}
                onPress={() => setAccepted((prev) => !prev)}
              />
              <Text style={styles.acceptText}>I have read and agree to the Terms & Conditions.</Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button mode="contained" onPress={handleContinue} loading={saving} disabled={saving}>
              Accept and Continue
            </Button>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eef2f6",
  },
  fakeBackgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    opacity: 0.7,
  },
  fakeStrip: {
    height: 78,
    borderRadius: 14,
    backgroundColor: "#d8dde3",
  },
  modalWrap: {
    width: "100%",
    paddingHorizontal: 18,
  },
  modalCard: {
    maxWidth: 620,
    alignSelf: "center",
    width: "100%",
    height: "78%",
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 10,
  },
  content: { padding: 18, paddingBottom: 26 },
  title: { fontSize: 26, fontWeight: "700", color: "#b71c1c", marginBottom: 8 },
  updated: { fontSize: 13, color: "#6d737a", marginBottom: 18 },
  body: {
    fontSize: 15,
    color: "#222",
    lineHeight: 23,
    marginBottom: 14,
  },
  acceptRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  acceptText: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
});

