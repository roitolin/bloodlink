import { View, Text, Button, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function RequesterDashboard({ navigation }: any) {
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
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>Requester Dashboard</Text>
      <Text style={{ marginBottom: 20 }}>Search for donors and request blood here.</Text>
      <Button title="Logout" onPress={handleLogout} color="red" />
    </View>
  );
}