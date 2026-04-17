import { View, Text, Button, StyleSheet } from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useResponsive } from "../../utils/responsive";
import { useAppDialog } from "../../hooks/useAppDialog";

export default function RequesterDashboard({ navigation }: any) {
  const { logout } = useAuth();
  const { isDesktop } = useResponsive();
  const { showDialog, dialog } = useAppDialog();
  const handleLogout = () => {
    showDialog({
      title: "Log Out of BloodLink?",
      message: "You’ll be signed out of your account on this device.",
      tone: "warning",
      actions: [
        { label: "Cancel", mode: "text" },
        {
          label: "Log Out",
          mode: "contained",
          onPress: async () => {
            try {
              await logout();
            } catch (error: any) {
              showDialog({
                title: "Logout Failed",
                message: error?.message || "Failed to log out.",
                tone: "danger",
              });
            }
          },
        },
      ],
    });
  };

  return (
    <View style={[styles.container, isDesktop && styles.containerDesktop]}>
      <Text style={styles.title}>Requester Dashboard</Text>
      <Button title="Find Donors" onPress={() => navigation.navigate("Search")} />
      <View style={{ marginVertical: 8 }} />
      <Button title="My Requests" onPress={() => navigation.navigate("Requests")} />
      <View style={{ marginVertical: 8 }} />
      <Button title="Logout" onPress={handleLogout} color="red" />
      {dialog}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 30, color: "#d32f2f" },
  containerDesktop: { maxWidth: 600, alignSelf: "center", width: "100%" },
});

