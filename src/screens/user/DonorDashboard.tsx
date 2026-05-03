import { View, Text, Button, StyleSheet } from "react-native";
import { useResponsive } from "../../utils/responsive";

export default function DonorDashboard({ navigation }: any) {
  const { isDesktop } = useResponsive();

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <Text style={styles.title}>Donor Dashboard</Text>
      <Button title="Edit Profile" onPress={() => navigation.navigate("Profile")} />
      <View style={{ marginVertical: 8 }} />
      <Button title="Back to Choices" onPress={() => navigation.getParent?.()?.getParent?.()?.navigate("ServiceHub")} color="#b91c1c" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: "#f5f5f5" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 30, color: "#d32f2f" },
  containerDesktop: { maxWidth: 600, alignSelf: "center", width: "100%" },
});
