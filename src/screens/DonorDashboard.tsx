import { View, Text, Button, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function DonorDashboard({ navigation }: any) {
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
      <Text style={{ fontSize: 24, fontWeight: "bold", marginBottom: 20 }}>Donor Dashboard</Text>
      <Button title="Edit Profile" onPress={() => navigation.navigate("DonorProfile")} />
      <View style={{ marginTop: 20 }}>
        <Button title="Logout" onPress={handleLogout} color="red" />
      </View>
    </View>
  );
}