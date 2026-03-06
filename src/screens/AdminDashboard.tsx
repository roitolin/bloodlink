import { View, Text, Button, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function AdminDashboard({ navigation }: any) {
  const { logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error: any) {
      Alert.alert("Logout Failed", error.message || "An error occurred during logout.");
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>Admin Dashboard</Text>
      <Text style={{ marginBottom: 20 }}>Manage users and view analytics.</Text>
      <Button title="Logout" onPress={handleLogout} color="red" />
    </View>
  );
}