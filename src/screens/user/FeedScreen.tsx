import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View, StyleSheet, Alert, Modal, RefreshControl, Pressable } from "react-native";
import { Card, Text, Button, useTheme } from "react-native-paper";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { collection, doc, getDoc, getDocs, updateDoc } from "firebase/firestore";
import { auth, db } from "../../services/firebaseConfig";
import { useAuth } from "../../context/AuthContext";
import { useResponsive } from "../../utils/responsive";
import AnnouncementsBanner from "../../components/AnnouncementsBanner";
import EmergencyBroadcastBanner from "../../components/EmergencyBroadcastBanner";

type DonorHero = {
  donorId: string;
  fullName: string;
  donationCount: number;
};

type DashboardAction = {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  tone: "primary" | "warm" | "cool" | "soft";
  onPress: () => void;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const getHeroInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "BL";

const getActionToneStyle = (tone: DashboardAction["tone"]) => {
  switch (tone) {
    case "warm":
      return {
        backgroundColor: "#fff7ed",
        borderColor: "#fdba74",
        iconBg: "#ea580c",
      };
    case "cool":
      return {
        backgroundColor: "#eff6ff",
        borderColor: "#93c5fd",
        iconBg: "#2563eb",
      };
    case "soft":
      return {
        backgroundColor: "#f5f3ff",
        borderColor: "#c4b5fd",
        iconBg: "#7c3aed",
      };
    default:
      return {
        backgroundColor: "#fff1f2",
        borderColor: "#fda4af",
        iconBg: "#be123c",
      };
  }
};

export default function FeedScreen({ navigation, route }: any) {
  const { isDesktop } = useResponsive();
  const theme = useTheme();
  const { termsAccepted, refreshUserProfile } = useAuth();
  const [localAccepted, setLocalAccepted] = useState(false);
  const [savingTerms, setSavingTerms] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewerCity, setViewerCity] = useState("");
  const [viewerBloodType, setViewerBloodType] = useState("");
  const [donorHeroes, setDonorHeroes] = useState<DonorHero[]>([]);
  const lastNavRefreshTokenRef = useRef<number | null>(null);

  const loadViewerProfile = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void loadViewerProfile();
  }, [loadViewerProfile]);

  const loadDonorHeroes = useCallback(async () => {
    try {
      const historySnap = await getDocs(collection(db, "donation_history"));
      const byDonor = new Map<string, number>();

      historySnap.docs.forEach((item) => {
        const data = item.data() as { donorId?: string };
        const donorId = String(data?.donorId || "").trim();
        if (!donorId) return;
        byDonor.set(donorId, (byDonor.get(donorId) || 0) + 1);
      });

      const topDonorIds = Array.from(byDonor.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      if (topDonorIds.length === 0) {
        setDonorHeroes([]);
        return;
      }

      const heroes = await Promise.all(
        topDonorIds.map(async ([donorId, donationCount]) => {
          const userSnap = await getDoc(doc(db, "users", donorId));
          const userData = userSnap.data() as { fullName?: string } | undefined;
          return {
            donorId,
            fullName: String(userData?.fullName || `Donor ${donorId.slice(0, 6)}`),
            donationCount,
          };
        })
      );

      setDonorHeroes(heroes);
    } catch {
      setDonorHeroes([]);
    }
  }, []);

  useEffect(() => {
    void loadDonorHeroes();
  }, [loadDonorHeroes]);

  const refreshFeed = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadViewerProfile(), loadDonorHeroes(), refreshUserProfile()]);
    } finally {
      setRefreshing(false);
    }
  }, [loadDonorHeroes, loadViewerProfile, refreshUserProfile]);

  useEffect(() => {
    const refreshToken = route?.params?.refreshToken;
    if (!refreshToken || refreshToken === lastNavRefreshTokenRef.current) return;
    lastNavRefreshTokenRef.current = refreshToken;
    void refreshFeed();
  }, [refreshFeed, route?.params?.refreshToken]);

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

  const openSearchDonors = () =>
    navigation.getParent()?.navigate("Search", {
      screen: "SearchDonors",
      params: { resetFilters: Date.now() },
    });

  const openCreateRequest = () =>
    navigation.getParent()?.navigate("Requests", {
      screen: "CreateRequest",
    });

  const openProfile = () => navigation.getParent()?.navigate("Profile");

  const dashboardActions: DashboardAction[] = [
    {
      key: "donors",
      icon: "people-outline",
      title: "Find Donors",
      subtitle: "Search nearby verified matches",
      tone: "primary",
      onPress: openSearchDonors,
    },
    {
      key: "request",
      icon: "water-outline",
      title: "Create Request",
      subtitle: "Post an urgent blood need",
      tone: "warm",
      onPress: openCreateRequest,
    },
    {
      key: "messages",
      icon: "chatbubble-ellipses-outline",
      title: "Messages",
      subtitle: "Continue donor and support chats",
      tone: "cool",
      onPress: () => navigation.navigate("Conversations"),
    },
    {
      key: "guide",
      icon: "book-outline",
      title: "Donation Guide",
      subtitle: "Read simple donor FAQs",
      tone: "soft",
      onPress: () => navigation.navigate("HowToDonate"),
    },
  ];

  const topHero = donorHeroes[0] || null;

  return (
    <View style={styles.screen}>
      <View style={styles.backgroundOrbTop} pointerEvents="none" />
      <View style={styles.backgroundOrbBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={[styles.container, isDesktop && styles.containerDesktop]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshFeed} tintColor={theme.colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroShell}>
          <View style={styles.heroGlowPrimary} pointerEvents="none" />
          <View style={styles.heroGlowSecondary} pointerEvents="none" />

          <Card style={styles.heroCard} mode="elevated">
            <Card.Content style={styles.heroContent}>
              <View style={styles.heroTopRow}>
                <View style={styles.heroHeadingWrap}>
                  <Text style={styles.heroEyebrow}>{getGreeting()}</Text>
                  <Text style={styles.heroTitle}>LifeCycle Dashboard</Text>
                  <Text style={styles.heroSubtitle}>
                    Stay close to urgent needs, verified donors, and live community updates in one place.
                  </Text>
                </View>
                <View style={styles.heroBadgeColumn}>
                  <View style={styles.heroMiniBadge}>
                    <Ionicons name="pulse-outline" size={15} color="#fff" />
                    <Text style={styles.heroMiniBadgeText}>Live</Text>
                  </View>
                </View>
              </View>

              <View style={styles.heroInsightRow}>
                <View style={styles.heroInsightCard}>
                  <Text style={styles.heroInsightLabel}>Your area</Text>
                  <Text style={styles.heroInsightValue}>{viewerCity || "Set your city"}</Text>
                </View>
                <View style={styles.heroInsightCard}>
                  <Text style={styles.heroInsightLabel}>Blood type</Text>
                  <Text style={styles.heroInsightValue}>{viewerBloodType || "Add profile info"}</Text>
                </View>
              </View>

              <View style={styles.heroPillsRow}>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Fast matching</Text>
                </View>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Verified donors</Text>
                </View>
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>Local alerts</Text>
                </View>
              </View>

              <View style={styles.heroActions}>
                <Button
                  mode="contained"
                  icon="account-search"
                  onPress={openSearchDonors}
                  style={styles.heroPrimaryButton}
                  buttonColor="#fff7ed"
                  textColor="#7f1d1d"
                  labelStyle={styles.heroPrimaryButtonLabel}
                >
                  Browse Donors
                </Button>
                <Button
                  mode="outlined"
                  icon="water"
                  onPress={() => navigation.navigate("AvailableRequests")}
                  style={styles.heroSecondaryButton}
                  textColor="#fff7ed"
                  labelStyle={styles.heroSecondaryButtonLabel}
                >
                  Active Requests
                </Button>
              </View>
            </Card.Content>
          </Card>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Action Center</Text>
          <Text style={styles.sectionTitle}>Jump back in fast</Text>
        </View>

        <View style={styles.actionGrid}>
          {dashboardActions.map((action) => {
            const toneStyle = getActionToneStyle(action.tone);
            return (
              <Pressable
                key={action.key}
                style={[
                  styles.actionCard,
                  {
                    backgroundColor: toneStyle.backgroundColor,
                    borderColor: toneStyle.borderColor,
                  },
                ]}
                onPress={action.onPress}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: toneStyle.iconBg }]}>
                  <Ionicons name={action.icon} size={20} color="#fff" />
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionSubtitle}>{action.subtitle}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.signalRow}>
          <View style={styles.signalCardPrimary}>
            <Text style={styles.signalLabel}>Community reach</Text>
            <Text style={styles.signalValue}>24/7</Text>
            <Text style={styles.signalCopy}>Requests stay visible so help can arrive anytime.</Text>
          </View>
          <View style={styles.signalCardSecondary}>
            <Text style={styles.signalLabelMuted}>Support flow</Text>
            <Text style={styles.signalValueDark}>1 App</Text>
            <Text style={styles.signalCopyMuted}>Donors, requesters, messages, and updates stay connected.</Text>
          </View>
        </View>

        <AnnouncementsBanner />
        <EmergencyBroadcastBanner viewerCity={viewerCity} viewerBloodType={viewerBloodType} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Overview</Text>
          <Text style={styles.sectionTitle}>What you can do here</Text>
        </View>

        <Card style={styles.storyCard} mode="elevated">
          <Card.Content>
            <View style={styles.storyRow}>
              <Ionicons name="location-outline" size={20} color="#9f1239" />
              <Text style={styles.storyText}>Search and match with nearby available donors by blood type and location.</Text>
            </View>
            <View style={styles.storyRow}>
              <Ionicons name="navigate-outline" size={20} color="#9f1239" />
              <Text style={styles.storyText}>Create urgent blood requests with a pinned map location for faster responses.</Text>
            </View>
            <View style={styles.storyRow}>
              <Ionicons name="call-outline" size={20} color="#9f1239" />
              <Text style={styles.storyText}>Contact donors and support through chat, call, and SMS when every minute matters.</Text>
            </View>
            <View style={styles.storyRow}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#9f1239" />
              <Text style={styles.storyText}>Track your requests and keep your donor profile ready for real emergencies.</Text>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Community</Text>
          <Text style={styles.sectionTitle}>Donor heroes</Text>
        </View>

        <Card style={styles.heroesCard} mode="elevated">
          <Card.Content>
            {topHero ? (
              <View style={styles.topHeroSpotlight}>
                <View style={styles.topHeroAvatar}>
                  <Text style={styles.topHeroAvatarText}>{getHeroInitials(topHero.fullName)}</Text>
                </View>
                <View style={styles.topHeroBody}>
                  <Text style={styles.topHeroLabel}>Top donor this cycle</Text>
                  <Text style={styles.topHeroName}>{topHero.fullName}</Text>
                  <Text style={styles.topHeroMeta}>
                    {topHero.donationCount} completed donation{topHero.donationCount > 1 ? "s" : ""}
                  </Text>
                </View>
                <View style={styles.topHeroMedal}>
                  <Ionicons name="trophy" size={18} color="#92400e" />
                </View>
              </View>
            ) : (
              <Text style={styles.emptyHeroesText}>
                No completed donations yet. The first successful donor will appear here.
              </Text>
            )}

            {donorHeroes.length > 1 ? (
              <View style={styles.heroLeaderboard}>
                {donorHeroes.slice(1).map((hero, index) => (
                  <View key={hero.donorId} style={styles.heroRow}>
                    <View style={styles.heroRankBadge}>
                      <Text style={styles.heroRankText}>#{index + 2}</Text>
                    </View>
                    <Text style={styles.heroName}>{hero.fullName}</Text>
                    <Text style={styles.heroCount}>
                      {hero.donationCount} donation{hero.donationCount > 1 ? "s" : ""}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </Card.Content>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionEyebrow}>Shortcuts</Text>
          <Text style={styles.sectionTitle}>Keep your account ready</Text>
        </View>

        <View style={styles.utilityStack}>
          <Pressable style={styles.utilityCard} onPress={openCreateRequest}>
            <View style={styles.utilityIconWrap}>
              <Ionicons name="medical-outline" size={20} color="#be123c" />
            </View>
            <View style={styles.utilityBody}>
              <Text style={styles.utilityTitle}>Need blood fast?</Text>
              <Text style={styles.utilityText}>Create a request now and connect with available donors right away.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </Pressable>

          <Pressable style={styles.utilityCard} onPress={() => navigation.navigate("Conversations")}>
            <View style={styles.utilityIconWrap}>
              <Ionicons name="chatbox-ellipses-outline" size={20} color="#be123c" />
            </View>
            <View style={styles.utilityBody}>
              <Text style={styles.utilityTitle}>Open your inbox</Text>
              <Text style={styles.utilityText}>Continue conversations with donors, requesters, and support.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </Pressable>

          <Pressable style={styles.utilityCard} onPress={openProfile}>
            <View style={styles.utilityIconWrap}>
              <Ionicons name="person-circle-outline" size={20} color="#be123c" />
            </View>
            <View style={styles.utilityBody}>
              <Text style={styles.utilityTitle}>Update your details</Text>
              <Text style={styles.utilityText}>Keep your city, profile, and contact info current so people can trust your account.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={!termsAccepted} transparent animationType="fade" statusBarTranslucent>
        <View style={styles.termsOverlay}>
          <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFillObject} />
          <View style={styles.termsBackdropTint} />
          <View style={styles.termsModalCard}>
            <Text style={styles.termsTitle}>Terms & Conditions</Text>
            <Text style={styles.termsBody}>
              By using LifeCycle, you agree to provide accurate information, communicate respectfully, and use this platform only for legitimate blood donation and support needs.
            </Text>
            <Text style={styles.termsBody}>
              LifeCycle helps connect donors and requesters, but it does not replace medical professionals or accredited blood centers.
            </Text>
            <Pressable
              style={styles.termsAcceptRow}
              onPress={() => setLocalAccepted((prev) => !prev)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: localAccepted }}
            >
              <View style={[styles.termsCheckboxBox, localAccepted && styles.termsCheckboxBoxChecked]}>
                {localAccepted ? <Text style={styles.termsCheckboxMark}>{"\u2713"}</Text> : null}
              </View>
              <Text style={styles.termsAcceptText}>I have read and agree to the Terms & Conditions.</Text>
            </Pressable>
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
  screen: {
    flex: 1,
    backgroundColor: "#f6f2ec",
  },
  backgroundOrbTop: {
    position: "absolute",
    top: -70,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(244, 63, 94, 0.09)",
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: 40,
    left: -70,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(251, 146, 60, 0.08)",
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 34,
    gap: 16,
  },
  containerDesktop: {
    maxWidth: 900,
    alignSelf: "center",
    width: "100%",
  },
  heroShell: {
    position: "relative",
  },
  heroGlowPrimary: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 40,
    height: 120,
    borderRadius: 28,
    backgroundColor: "rgba(190, 24, 93, 0.15)",
  },
  heroGlowSecondary: {
    position: "absolute",
    right: 0,
    top: 34,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(249, 115, 22, 0.14)",
  },
  heroCard: {
    borderRadius: 28,
    backgroundColor: "#7f1d1d",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  heroContent: {
    padding: 18,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
  },
  heroHeadingWrap: {
    flex: 1,
  },
  heroEyebrow: {
    color: "#fecdd3",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTitle: {
    color: "#fffaf5",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
  },
  heroSubtitle: {
    marginTop: 10,
    color: "#ffe4e6",
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 420,
  },
  heroBadgeColumn: {
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  heroMiniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  heroMiniBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  heroInsightRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  heroInsightCard: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  heroInsightLabel: {
    color: "#fecdd3",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  heroInsightValue: {
    marginTop: 4,
    color: "#fff",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  heroPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  heroPill: {
    borderRadius: 999,
    backgroundColor: "#fff1f2",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroPillText: {
    color: "#9f1239",
    fontSize: 12,
    fontWeight: "800",
  },
  heroActions: {
    marginTop: 18,
    gap: 10,
  },
  heroPrimaryButton: {
    borderRadius: 14,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  heroPrimaryButtonLabel: {
    color: "#7f1d1d",
    fontSize: 15,
    fontWeight: "900",
  },
  heroSecondaryButton: {
    borderRadius: 14,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "transparent",
  },
  heroSecondaryButtonLabel: {
    color: "#fff7ed",
    fontSize: 15,
    fontWeight: "800",
  },
  sectionHeader: {
    marginTop: 4,
    gap: 2,
  },
  sectionEyebrow: {
    color: "#be123c",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 22,
    fontWeight: "900",
  },
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    width: "48%",
    minHeight: 148,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  actionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 20,
  },
  actionSubtitle: {
    marginTop: 6,
    color: "#4b5563",
    fontSize: 13,
    lineHeight: 19,
  },
  signalRow: {
    flexDirection: "row",
    gap: 12,
  },
  signalCardPrimary: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#111827",
    padding: 16,
  },
  signalCardSecondary: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: "#fffaf5",
    borderWidth: 1,
    borderColor: "#e7d8ca",
    padding: 16,
  },
  signalLabel: {
    color: "#fda4af",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  signalLabelMuted: {
    color: "#9a3412",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  signalValue: {
    marginTop: 8,
    color: "#fff",
    fontSize: 28,
    fontWeight: "900",
  },
  signalValueDark: {
    marginTop: 8,
    color: "#111827",
    fontSize: 28,
    fontWeight: "900",
  },
  signalCopy: {
    marginTop: 6,
    color: "#d1d5db",
    fontSize: 13,
    lineHeight: 19,
  },
  signalCopyMuted: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 19,
  },
  storyCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#eadfd5",
    backgroundColor: "#fffdf9",
  },
  storyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 8,
  },
  storyText: {
    flex: 1,
    color: "#374151",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "600",
  },
  heroesCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#ecdcc4",
    backgroundColor: "#fff8ef",
  },
  topHeroSpotlight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 14,
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#f3e5d1",
  },
  topHeroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#881337",
    alignItems: "center",
    justifyContent: "center",
  },
  topHeroAvatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },
  topHeroBody: {
    flex: 1,
  },
  topHeroLabel: {
    color: "#9a3412",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  topHeroName: {
    marginTop: 4,
    color: "#111827",
    fontSize: 17,
    fontWeight: "900",
  },
  topHeroMeta: {
    marginTop: 3,
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "700",
  },
  topHeroMedal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fed7aa",
  },
  emptyHeroesText: {
    color: "#6b7280",
    lineHeight: 21,
    fontSize: 14,
  },
  heroLeaderboard: {
    marginTop: 14,
    gap: 10,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: "#f1e4d5",
  },
  heroRankBadge: {
    minWidth: 38,
    borderRadius: 999,
    backgroundColor: "#fff1f2",
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  heroRankText: {
    color: "#9f1239",
    fontWeight: "900",
    fontSize: 12,
  },
  heroName: {
    flex: 1,
    color: "#1f2937",
    fontWeight: "700",
    fontSize: 14,
  },
  heroCount: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "800",
  },
  utilityStack: {
    gap: 12,
  },
  utilityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eadfd5",
  },
  utilityIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff1f2",
  },
  utilityBody: {
    flex: 1,
  },
  utilityTitle: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },
  utilityText: {
    marginTop: 4,
    color: "#6b7280",
    fontSize: 13,
    lineHeight: 19,
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
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 12,
  },
  termsCheckboxBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#b91c1c",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  termsCheckboxBoxChecked: {
    backgroundColor: "#b91c1c",
    borderColor: "#b91c1c",
  },
  termsCheckboxMark: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 15,
    lineHeight: 16,
  },
  termsAcceptText: {
    flex: 1,
    color: "#333",
    fontSize: 14,
    lineHeight: 20,
  },
});
