import { Ionicons } from "@expo/vector-icons";
import { View, Text, ScrollView, StyleSheet, Image } from "react-native";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

type AboutSection = {
  title: string;
  description: string;
  icon: IconName;
};

const highlights = [
  { value: "24/7", label: "Urgent Support" },
  { value: "Fast", label: "Donor Matching" },
  { value: "Safe", label: "Verified Process" },
];

const sections: AboutSection[] = [
  {
    title: "BloodLink",
    icon: "pulse",
    description:
      "BloodLink connects donors and requesters faster during urgent blood needs. Our mission is to make blood donation more accessible, reliable, and community-driven.",
  },
  {
    title: "Why We Built This",
    icon: "megaphone",
    description:
      "Many families struggle to find blood donors during emergencies, often posting repeatedly on social media to be noticed. BloodLink gives them a dedicated place where urgent requests can be seen quickly and matched with willing donors.",
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

const systemMembers = [
  {
    name: "Roi Veinze A. Tolin",
    role: "Team Member",
    photo: require("../../../assets/member-photos/roi-veinze-tolin.png"),
  },
  {
    name: "Mary Sheen Punay",
    role: "Team Member",
    photo: require("../../../assets/member-photos/mary-sheen-punay.png"),
  },
  {
    name: "Daisy Derial",
    role: "Team Member",
    photo: require("../../../assets/member-photos/daisy-derial.jpg"),
  },
  {
    name: "Ezra Baguhin",
    role: "Team Member",
    photo: require("../../../assets/member-photos/ezra-baguhin.png"),
  },
  {
    name: "Samuel Monares",
    role: "Team Member",
    photo: require("../../../assets/member-photos/samuel-monares-jr.png"),
  },
  {
    name: "Cyrus Dan Coyoca",
    role: "Team Member",
    photo: require("../../../assets/member-photos/cyrus-coyoca.jpg"),
  },
];

export default function AboutUsScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={[styles.heroGlow, styles.heroGlowTop]} />
        <View style={[styles.heroGlow, styles.heroGlowBottom]} />
        <Text style={styles.badge}>Community Powered</Text>
        <Text style={styles.heroTitle}>About BloodLink</Text>
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

      <View style={styles.aboutCard}>
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}>
            <Ionicons name="people" size={18} color="#9a1d26" />
          </View>
          <Text style={styles.aboutTitle}>System Members</Text>
        </View>
        <Text style={styles.memberSubtitle}>Core team behind BloodLink</Text>
        <View style={styles.memberGrid}>
          {systemMembers.map((member) => (
            <View key={member.name} style={styles.memberCard}>
              <Image source={member.photo} style={styles.memberPhoto} resizeMode="cover" />
              <Text style={styles.memberName}>{member.name}</Text>
              <Text style={styles.memberRole}>{member.role}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
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
    marginBottom: 10,
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "600",
  },
  memberGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
  },
  memberCard: {
    width: "48%",
    borderWidth: 1,
    borderColor: "#eceff4",
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  memberPhoto: {
    width: 66,
    height: 66,
    borderRadius: 33,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
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
    fontWeight: "600",
  },
});

