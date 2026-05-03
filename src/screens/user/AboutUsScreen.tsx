import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  Modal,
  Pressable,
  TouchableOpacity,
  type ImageSourcePropType,
} from "react-native";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type AboutSection = {
  title: string;
  description: string;
  icon: IconName;
};

type Member = {
  name: string;
  role: string;
  quote: string;
  photo: ImageSourcePropType;
};

const highlights = [
  { value: "24/7", label: "Urgent Support" },
  { value: "Fast", label: "Donor Matching" },
  { value: "Safe", label: "Verified Process" },
];

const sections: AboutSection[] = [
  {
    title: "LifeCycle",
    icon: "pulse",
    description:
      "LifeCycle connects donors and requesters faster during urgent blood needs. Our mission is to make blood donation more accessible, reliable, and community-driven.",
  },
  {
    title: "Why We Built This",
    icon: "megaphone",
    description:
      "Many families struggle to find blood donors during emergencies, often posting repeatedly on social media to be noticed. LifeCycle gives them a dedicated place where urgent requests can be seen quickly and matched with willing donors.",
  },
  {
    title: "Our Mission",
    icon: "heart",
    description:
      "We help patients and families find blood donors quickly while promoting safe, responsible donation practices.",
  },
  {
    title: "Our Vision",
    icon: "sparkles",
    description:
      "A connected community where no blood request is ignored and every willing donor can help save lives.",
  },
];

const systemMembers: Member[] = [
  {
    name: "Roi Veinze A. Tolin",
    role: "Team Member",
    quote:
      "Your blood is a small gift with a monumental impact. Together, we can build a stronger, healthier world through compassion. Donate today.",
    photo: require("../../../assets/member-photos/roi-veinze-tolin.png"),
  },
  {
    name: "Mary Sheen Punay",
    role: "Team Member",
    quote:
      "Every donor gives more than blood. They give hope, time, and another chance for someone to keep living.",
    photo: require("../../../assets/member-photos/mary-sheen-punay.png"),
  },
  {
    name: "Daisy Derial",
    role: "Team Member",
    quote:
      "Compassion becomes powerful when it moves quickly. LifeCycle helps communities respond when every minute matters.",
    photo: require("../../../assets/member-photos/daisy-derial.jpg"),
  },
  {
    name: "Ezra Baguhin",
    role: "Team Member",
    quote:
      "One simple act of donation can connect strangers, strengthen families, and save lives in the moments that count most.",
    photo: require("../../../assets/member-photos/ezra-baguhin.png"),
  },
  {
    name: "Samuel Monares",
    role: "Team Member",
    quote:
      "When people come together for a shared purpose, urgent blood needs turn into stories of survival and community.",
    photo: require("../../../assets/member-photos/samuel-monares-jr.png"),
  },
  {
    name: "Cyrus Dan Coyoca",
    role: "Team Member",
    quote:
      "Technology should serve humanity. LifeCycle is built to make help visible, reachable, and immediate for those in need.",
    photo: require("../../../assets/member-photos/cyrus-coyoca.jpg"),
  },
];

export default function AboutUsScreen() {
  const [activeMember, setActiveMember] = useState<Member | null>(null);

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.heroGlow, styles.heroGlowTop]} />
          <View style={[styles.heroGlow, styles.heroGlowBottom]} />
          <Text style={styles.badge}>Community Powered</Text>
          <Text style={styles.heroTitle}>About LifeCycle</Text>
          <Text style={styles.heroSubtitle}>
            We are building a faster, more human way to connect blood donors and people in urgent
            need.
          </Text>

          <View style={styles.highlightRow}>
            {highlights.map((item) => (
              <View key={item.label} style={styles.highlightCard}>
                <Text style={styles.highlightValue}>{item.value}</Text>
                <Text style={styles.highlightLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={styles.aboutCard}>
            <View style={styles.cardHeader}>
              <View style={styles.iconWrap}>
                <Ionicons name={section.icon} size={18} color="#9a1d26" />
              </View>
              <Text style={styles.aboutTitle}>{section.title}</Text>
            </View>
            <Text style={styles.aboutText}>{section.description}</Text>
          </View>
        ))}

        <View style={[styles.aboutCard, styles.membersShowcaseCard]}>
          <View style={styles.cardHeader}>
            <View style={styles.iconWrap}>
              <Ionicons name="people" size={18} color="#9a1d26" />
            </View>
            <Text style={styles.aboutTitle}>System Members</Text>
          </View>
          <Text style={styles.memberCountPill}>{systemMembers.length} Members</Text>
          <Text style={styles.memberSubtitle}>Core team behind LifeCycle. Tap a member to view details.</Text>
          <View style={styles.memberGrid}>
            {systemMembers.map((member) => (
              <TouchableOpacity
                key={member.name}
                style={styles.memberCardTouchable}
                activeOpacity={0.86}
                onPress={() => setActiveMember(member)}
              >
                <View style={styles.memberCard}>
                  <Image source={member.photo} style={styles.memberPhoto} resizeMode="cover" />
                  <Text style={styles.memberName}>{member.name}</Text>
                  <Text style={styles.memberRole}>{member.role}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!activeMember} transparent animationType="fade" onRequestClose={() => setActiveMember(null)}>
        <Pressable style={styles.memberModalOverlay} onPress={() => setActiveMember(null)}>
          <Pressable style={styles.memberModalCard} onPress={(event) => event.stopPropagation()}>
            <Pressable style={styles.memberModalCloseBtn} onPress={() => setActiveMember(null)}>
              <Text style={styles.memberModalCloseText}>Close</Text>
            </Pressable>
            {activeMember ? (
              <View style={styles.memberModalBanner}>
                <Text style={styles.memberModalName}>{activeMember.name}</Text>
                <Text style={styles.memberModalRole}>{activeMember.role}</Text>
                <View style={styles.memberModalBody}>
                  <View style={styles.memberModalPhotoWrap}>
                    <Image source={activeMember.photo} style={styles.memberModalPhoto} resizeMode="contain" />
                  </View>
                  <Text style={styles.memberModalQuote}>&quot;{activeMember.quote}&quot;</Text>
                </View>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f6f8fb",
  },
  content: {
    padding: 18,
    paddingBottom: 28,
  },
  hero: {
    backgroundColor: "#af202a",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 22,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#9a1d26",
  },
  heroGlow: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroGlowTop: {
    width: 170,
    height: 170,
    top: -70,
    right: -45,
  },
  heroGlowBottom: {
    width: 120,
    height: 120,
    bottom: -50,
    left: -30,
  },
  badge: {
    color: "#ffdfe2",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 23,
    color: "#ffecef",
    marginBottom: 16,
  },
  highlightRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  highlightCard: {
    width: "31%",
    minWidth: 88,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 6,
  },
  highlightValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 2,
  },
  highlightLabel: {
    color: "#ffe3e7",
    fontSize: 11,
    fontWeight: "600",
  },
  aboutCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e4e8ee",
    padding: 16,
    marginBottom: 14,
    shadowColor: "#00101f",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffe7ea",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  aboutTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#971e28",
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 24,
    color: "#3f4d5a",
  },
  memberSubtitle: {
    marginTop: 2,
    marginBottom: 12,
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
  },
  membersShowcaseCard: {
    borderColor: "#f4d7da",
    backgroundColor: "#fffafb",
    shadowColor: "#911f29",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  memberCountPill: {
    alignSelf: "flex-start",
    marginTop: -2,
    marginBottom: 8,
    color: "#8f1c24",
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: "#ffeef1",
    borderWidth: 1,
    borderColor: "#ffd3d9",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    letterSpacing: 0.2,
  },
  memberGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  memberCardTouchable: {
    width: "48%",
  },
  memberCard: {
    borderWidth: 1,
    borderColor: "#f2d7db",
    borderRadius: 14,
    backgroundColor: "#fff7f8",
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    shadowColor: "#911f29",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  memberPhoto: {
    width: 76,
    height: 76,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "#ffffff",
    backgroundColor: "#ffffff",
  },
  memberName: {
    textAlign: "center",
    fontSize: 13,
    color: "#1f2937",
    fontWeight: "700",
    marginBottom: 2,
  },
  memberRole: {
    textAlign: "center",
    fontSize: 11,
    color: "#9a1d26",
    fontWeight: "700",
    backgroundColor: "#ffe7ea",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ffd3d9",
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  memberModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.65)",
    justifyContent: "center",
    padding: 18,
  },
  memberModalCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ead6da",
    backgroundColor: "#fffafb",
    padding: 12,
  },
  memberModalCloseBtn: {
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  memberModalCloseText: {
    color: "#7b2430",
    fontWeight: "700",
  },
  memberModalBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e8d8db",
    backgroundColor: "#fff9fb",
    padding: 12,
  },
  memberModalName: {
    color: "#931c26",
    fontSize: 25,
    lineHeight: 28,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  memberModalRole: {
    marginTop: 4,
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  memberModalBody: {
    marginTop: 10,
    gap: 12,
  },
  memberModalPhotoWrap: {
    borderWidth: 1,
    borderColor: "#f1d5d9",
    borderRadius: 14,
    padding: 8,
    backgroundColor: "#fff2f4",
  },
  memberModalPhoto: {
    width: "100%",
    height: 260,
    borderRadius: 12,
    backgroundColor: "#ffffff",
  },
  memberModalQuote: {
    color: "#1f2937",
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
    borderWidth: 1,
    borderColor: "#f0d9de",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    padding: 12,
  },
});

