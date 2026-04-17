import { useEffect, useState } from "react";
import { ScrollView, View, StyleSheet, Alert, Modal } from "react-native";
import { Card, Text, Button, useTheme, Checkbox } from "react-native-paper";
import { BlurView } from "expo-blur";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useResponsive } from "../../utils/responsive";
import AnnouncementsBanner from "../../components/AnnouncementsBanner";
import EmergencyBroadcastBanner from "../../components/EmergencyBroadcastBanner";

export default function FeedScreen({ navigation }: any) {
  const { isDesktop } = useResponsive();
  const theme = useTheme();
  const { termsAccepted, refreshUserProfile } = useAuth();
  const [localAccepted, setLocalAccepted] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);
  const [viewerCity, setViewerCity] = useState("");
  const [viewerBloodType, setViewerBloodType] = useState("");

  useEffect(() => {
    const loadViewerProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        const data = snap.data() as { city?: string; bloodType?: string } | undefined;
        setViewerCity(data?.city || "");
        setViewerBloodType(data?.bloodType || "");
      } catch {
        setViewerCity("");
        setViewerBloodType("");
      }
    };

    void loadViewerProfile();
  }, []);

  const handleAcceptTerms = async () => {
    if (!localAccepted) {
      Alert.alert("Required", "Please accept the Terms & Conditions to continue.");
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setSavingTerms(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        termsAccepted: true,
        termsAcceptedAt: new Date(),
      });
      await refreshUserProfile();
    } catch (error: any) {
      Alert.alert("Error", error?.message || "Failed to save terms acceptance.");
    } finally {
      setSavingTerms(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}>
        <Card style={styles.heroCard} mode="elevated">
          <Card.Content>
            <Text style={styles.heroTag}>LIFE-SAVING NETWORK</Text>
            <Text style={styles.heroTitle}>Welcome to BloodLink</Text>
            <Text style={styles.heroSubtitle}>
              Connect with donors, find urgent requests, and help save lives in your community.
            </Text>
            <View style={styles.badgesRow}>
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>Fast Matching</Text>
              </View>
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>Verified Donors</Text>
              </View>
              <View style={styles.badgePill}>
                <Text style={styles.badgeText}>Local Support</Text>
              </View>
            </View>
            <View style={styles.heroButtons}>
              <Button
                mode="contained"
                icon="account-search"
                onPress={() =>
                  navigation.getParent()?.navigate("Search", {
                    screen: "SearchDonors",
                    params: { resetFilters: Date.now() },
                  })
                }
                style={styles.heroButton}
              >
                Browse Available Donors
              </Button>
              <Button
                mode="outlined"
                icon="water"
                onPress={() => navigation.navigate("AvailableRequests")}
                style={styles.heroButton}
              >
                View Active Requests
              </Button>
            </View>
          </Card.Content>
        </Card>

        <AnnouncementsBanner />
        <EmergencyBroadcastBanner viewerCity={viewerCity} viewerBloodType={viewerBloodType} />

        <Card style={styles.featuresCard} mode="elevated">
          <Card.Title title="What You Can Do With BloodLink" />
          <Card.Content>
            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>{"●"}</Text>
              <Text style={styles.featureText}>Search and match with nearby available donors by blood type.</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>{"●"}</Text>
              <Text style={styles.featureText}>Create urgent blood requests with pinned map location.</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>{"●"}</Text>
              <Text style={styles.featureText}>Contact donors and support via chat, call, and SMS.</Text>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>{"●"}</Text>
              <Text style={styles.featureText}>Track request status and manage your donor profile.</Text>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.metricsRow}>
          <Card style={styles.metricCard} mode="elevated">
            <Card.Content>
              <Text style={styles.metricValue}>24/7</Text>
              <Text style={styles.metricLabel}>Request Visibility</Text>
            </Card.Content>
          </Card>
          <Card style={styles.metricCard} mode="elevated">
            <Card.Content>
              <Text style={styles.metricValue}>1 App</Text>
              <Text style={styles.metricLabel}>For Donors & Requests</Text>
            </Card.Content>
          </Card>
        </View>

        <Card style={styles.card} mode="elevated">
          <Card.Title title="Need Blood Fast?" />
          <Card.Content>
            <Text style={styles.cardText}>
              Create your own blood request and connect with available donors right away.
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button
              mode="contained"
              icon="plus-circle"
              onPress={() =>
                navigation.getParent()?.navigate("Requests", {
                  screen: "CreateRequest",
                })
              }
            >
              Create Blood Request
            </Button>
          </Card.Actions>
        </Card>

        <Card style={styles.card} mode="elevated">
          <Card.Title title="Need Help, Follow-up, or Updates?" />
          <Card.Content>
            <Text style={styles.cardText}>
              Open your inbox to continue conversations with donors, requesters, and support.
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button
              mode="outlined"
              icon="chat-processing"
              onPress={() => navigation.navigate("Conversations")}
            >
              Open Messages
            </Button>
          </Card.Actions>
        </Card>

        <Card style={styles.card} mode="elevated">
          <Card.Title title="New to Blood Donation?" />
          <Card.Content>
            <Text style={styles.cardText}>
              Read simple donation FAQs to learn eligibility, safety, and what to expect before your
              donation.
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button mode="contained-tonal" icon="book-open-page-variant" onPress={() => navigation.navigate("HowToDonate")}>
              How to Donate
            </Button>
          </Card.Actions>
        </Card>

        <Card style={styles.card} mode="elevated">
          <Card.Title title="Need to Update Your Details?" />
          <Card.Content>
            <Text style={styles.cardText}>
              Keep your profile complete so other users can trust your information and contact you
              quickly when needed.
            </Text>
          </Card.Content>
          <Card.Actions>
            <Button mode="outlined" icon="account-edit" onPress={() => navigation.getParent()?.navigate("Profile")}>
              Manage Profile
            </Button>
          </Card.Actions>
        </Card>

        <View style={styles.bottomButtons}>
          <Button
            mode="text"
            icon="account-heart"
            onPress={() => navigation.getParent()?.navigate("Profile")}
          >
            Manage Profile
          </Button>
          <Button
            mode="text"
            icon="home-heart"
            textColor={theme.colors.primary}
            onPress={() =>
              navigation.getParent()?.navigate("Search", {
                screen: "SearchDonors",
                params: { resetFilters: Date.now() },
              })
            }
          >
            Find Donors
          </Button>
        </View>
      </ScrollView>

      <Modal visible={!termsAccepted} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.termsOverlay}>
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={styles.termsBackdropTint} />
          <View style={styles.termsModalCard}>
            <Text style={styles.termsTitle}>Terms & Conditions</Text>
            <Text style={styles.termsBody}>
              By using BloodLink, you agree to provide accurate information, communicate
              respectfully, and use this platform only for legitimate blood donation and support
              needs.
            </Text>
            <Text style={styles.termsBody}>
              BloodLink helps connect donors and requesters, but it does not replace medical
              professionals or accredited blood centers.
            </Text>
            <View style={styles.termsAcceptRow}>
              <Checkbox
                status={localAccepted ? "checked" : "unchecked"}
                onPress={() => setLocalAccepted((prev) => !prev)}
              />
              <Text style={styles.termsAcceptText}>I have read and agree to the Terms & Conditions.</Text>
            </View>
            <Button mode="contained" onPress={handleAcceptTerms} loading={savingTerms} disabled={savingTerms}>
              Accept and Continue
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#f5f5f5",
    gap: 14,
  },
  heroCard: {
    borderRadius: 14,
    backgroundColor: "#fff7f7",
    borderWidth: 1,
    borderColor: "#f4d7d7",
    shadowColor: "#111827",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  heroTag: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b91c1c",
    letterSpacing: 1,
    marginBottom: 6,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#b71c1c",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: "#555",
    lineHeight: 22,
    marginBottom: 14,
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  badgePill: {
    backgroundColor: "#ffebee",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: "#b71c1c",
    fontSize: 12,
    fontWeight: "700",
  },
  heroButtons: {
    gap: 10,
    marginTop: 2,
  },
  heroButton: {
    borderRadius: 8,
  },
  card: {
    marginBottom: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eceff3",
    backgroundColor: "#ffffff",
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  metricCard: {
    flex: 1,
    minWidth: 140,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#eceff3",
  },
  featuresCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#eceff3",
    backgroundColor: "#fff",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 7,
  },
  featureIcon: {
    color: "#b91c1c",
    marginTop: 2,
    marginRight: 8,
    fontWeight: "800",
  },
  featureText: {
    flex: 1,
    color: "#374151",
    lineHeight: 20,
    fontSize: 14,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#b71c1c",
  },
  metricLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  cardText: {
    fontSize: 14,
    color: "#555",
    lineHeight: 21,
  },
  bottomButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  termsOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  termsBackdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15, 20, 28, 0.26)",
  },
  termsModalCard: {
    width: "100%",
    maxWidth: 640,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    padding: 18,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
    elevation: 10,
  },
  termsTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#b71c1c",
    marginBottom: 10,
  },
  termsBody: {
    fontSize: 14,
    color: "#222",
    lineHeight: 22,
    marginBottom: 10,
  },
  termsAcceptRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  termsAcceptText: {
    flex: 1,
    color: "#333",
    fontSize: 14,
  },
  containerDesktop: {
    maxWidth: 900,
    alignSelf: "center",
    width: "100%",
  },
});

