import { SafeAreaView } from "react-native-safe-area-context";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { appServices } from "@/config/appServices";
import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/services/firebaseConfig";

const maleDefault = require("../../../assets/Male_Default_Profile.png");
const femaleDefault = require("../../../assets/Female_Default_Profile.png");
const otherDefault = require("../../../assets/Male_Default_Profile.png");

export default function ServiceHubScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [gender, setGender] = useState<"male" | "female" | "other" | null>(null);

  const getDefaultImage = useCallback(() => {
    if (gender === "male") return maleDefault;
    if (gender === "female") return femaleDefault;
    return otherDefault;
  }, [gender]);

  useFocusEffect(
    useCallback(() => {
      const loadAccountPreview = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        try {
          const snapshot = await getDoc(doc(db, "users", currentUser.uid));
          if (!snapshot.exists()) return;
          const data = snapshot.data();
          setPhotoURL(data.photoURL || null);
          setGender((data.gender as "male" | "female" | "other" | null) || null);
        } catch {
          // Ignore account preview refresh errors on hub load.
        }
      };

      void loadAccountPreview();
    }, [])
  );

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={20} color="#c2410c" />
            </View>
            <View style={styles.accountMenuWrap}>
              <Pressable style={styles.accountPill} onPress={() => setMenuOpen((prev) => !prev)}>
                <View style={styles.accountAvatar}>
                  {photoURL ? (
                    <Image source={{ uri: photoURL }} style={styles.accountAvatarImage} resizeMode="cover" />
                  ) : (
                    <Image source={getDefaultImage()} style={styles.accountAvatarImage} resizeMode="cover" />
                  )}
                </View>
                <View style={styles.accountChevron}>
                  <Ionicons name={menuOpen ? "chevron-up" : "chevron-down"} size={18} color="#111111" />
                </View>
              </Pressable>

              {menuOpen && (
                <View style={styles.dropdownMenu}>
                  <Text numberOfLines={1} style={styles.dropdownEmail}>{user?.email || "your account"}</Text>
                  <Pressable
                    style={[styles.dropdownItem, styles.editItem]}
                    onPress={() => {
                      setMenuOpen(false);
                      navigation.navigate("AccountSettings");
                    }}
                  >
                    <Ionicons name="create-outline" size={16} color="#92400e" />
                    <Text style={styles.dropdownEditText}>Edit Account Details</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.dropdownItem, styles.logoutItem]}
                    onPress={async () => {
                      setMenuOpen(false);
                      await logout();
                    }}
                  >
                    <Ionicons name="log-out-outline" size={16} color="#b91c1c" />
                    <Text style={styles.dropdownItemText}>Log Out</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.kicker}>Account Verified</Text>
          <Text style={styles.title}>Choose where you want to go next</Text>
          <Text style={styles.subtitle}>
            Choose the service you need below. You can return to this hub anytime after opening a section.
          </Text>
        </View>

        <View style={styles.grid}>
          <View style={[styles.serviceCard, styles.bloodCard]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconWrap, styles.bloodIconWrap]}>
                <Ionicons name={appServices.bloodlink.icon as any} size={24} color={appServices.bloodlink.accent} />
              </View>
              <Pressable style={[styles.openPill, styles.bloodOpenPill]} onPress={() => navigation.navigate("BloodLinkApp")}>
                <Text style={[styles.openPillText, { color: appServices.bloodlink.accent }]}>Open</Text>
                <Ionicons name="arrow-forward" size={14} color={appServices.bloodlink.accent} />
              </Pressable>
            </View>
            <Text style={styles.cardTitle}>{appServices.bloodlink.shortLabel}</Text>
            <Text style={styles.cardBody}>{appServices.bloodlink.description}</Text>
            <View style={styles.tagRow}>
              <View style={[styles.miniTag, styles.bloodMiniTag]}>
                <Text style={[styles.miniTagText, { color: appServices.bloodlink.accent }]}>Donate Blood</Text>
              </View>
              <View style={[styles.miniTag, styles.bloodMiniTag]}>
                <Text style={[styles.miniTagText, { color: appServices.bloodlink.accent }]}>Request Blood Support</Text>
              </View>
            </View>
          </View>

          <View style={[styles.serviceCard, styles.funeralCard]}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconWrap, styles.funeralIconWrap]}>
                <MaterialCommunityIcons name={appServices.funeral.icon as any} size={24} color={appServices.funeral.accent} />
              </View>
              <Pressable style={[styles.openPill, styles.funeralOpenPill]} onPress={() => navigation.navigate("FuneralApp")}>
                <Text style={[styles.openPillText, { color: appServices.funeral.accent }]}>Open</Text>
                <Ionicons name="arrow-forward" size={14} color={appServices.funeral.accent} />
              </Pressable>
            </View>
            <Text style={styles.cardTitle}>{appServices.funeral.shortLabel}</Text>
            <Text style={styles.cardBody}>{appServices.funeral.description}</Text>
            <View style={styles.tagRow}>
              <View style={[styles.miniTag, styles.funeralMiniTag]}>
                <Text style={[styles.miniTagText, { color: appServices.funeral.accent }]}>View Funeral Services</Text>
              </View>
              <View style={[styles.miniTag, styles.funeralMiniTag]}>
                <Text style={[styles.miniTagText, { color: appServices.funeral.accent }]}>Plan Arrangements</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.helperCard}>
          <Ionicons name="swap-horizontal-outline" size={18} color="#92400e" />
          <Text style={styles.helperText}>You can return to this service hub anytime after opening either section.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fffaf7",
  },
  glowTop: {
    position: "absolute",
    top: -100,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "#fed7aa",
  },
  glowBottom: {
    position: "absolute",
    left: -80,
    bottom: -70,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  content: {
    padding: 20,
    paddingBottom: 28,
  },
  heroCard: {
    marginTop: 12,
    backgroundColor: "#ffffff",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 24,
    shadowColor: "#c2410c",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  accountMenuWrap: {
    maxWidth: "74%",
    position: "relative",
    zIndex: 6,
  },
  accountPill: {
    minWidth: 78,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    borderRadius: 18,
    paddingVertical: 5,
    paddingHorizontal: 5,
    backgroundColor: "#ffffff",
    shadowColor: "#111111",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  accountAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  accountAvatarImage: {
    width: "100%",
    height: "100%",
  },
  heroBadge: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffedd5",
  },
  accountChevron: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  dropdownMenu: {
    position: "absolute",
    top: 78,
    right: 0,
    minWidth: 210,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: 10,
    shadowColor: "#111111",
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  dropdownEmail: {
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  editItem: {
    backgroundColor: "#fff7ed",
    borderColor: "#fed7aa",
  },
  logoutItem: {
    marginTop: 8,
  },
  dropdownEditText: {
    color: "#92400e",
    fontSize: 14,
    fontWeight: "800",
  },
  dropdownItemText: {
    color: "#b91c1c",
    fontSize: 14,
    fontWeight: "800",
  },
  kicker: {
    color: "#c2410c",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    color: "#111827",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "900",
    marginBottom: 10,
  },
  subtitle: {
    color: "#6b7280",
    fontSize: 15,
    lineHeight: 23,
  },
  grid: {
    marginTop: 18,
    gap: 14,
  },
  serviceCard: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 20,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  bloodCard: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecaca",
    shadowColor: "#ef4444",
  },
  funeralCard: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    shadowColor: "#334155",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  bloodIconWrap: {
    backgroundColor: "#ffe4e6",
  },
  funeralIconWrap: {
    backgroundColor: "#e2e8f0",
  },
  openPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  bloodOpenPill: {
    backgroundColor: "#fffafa",
    borderColor: "#fecaca",
  },
  funeralOpenPill: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
  },
  openPillText: {
    fontSize: 13,
    fontWeight: "800",
  },
  cardTitle: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
  },
  cardBody: {
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 14,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  miniTag: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  bloodMiniTag: {
    backgroundColor: "#fffafa",
    borderColor: "#fecaca",
  },
  funeralMiniTag: {
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
  },
  miniTagText: {
    fontSize: 12,
    fontWeight: "700",
  },
  helperCard: {
    marginTop: 14,
    marginBottom: 18,
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  helperText: {
    flex: 1,
    color: "#9a3412",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
});
