import { View, Text, Button, Alert, StyleSheet } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function DashboardScreen({ navigation }: any) {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error: any) {
      Alert.alert("Logout Failed", error.message || "An error occurred during logout.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.welcome}>Welcome, {user?.email || "User"}!</Text>
      <Button title="Search for Donors" onPress={() => navigation.navigate("Search")} />
      <View style={{ marginVertical: 8 }} />
      <Button title="Request Blood" onPress={() => navigation.navigate("Requests")} />
      <View style={{ marginVertical: 8 }} />
      <Button title="Edit Profile" onPress={() => navigation.navigate("Profile")} />
      <View style={{ marginVertical: 8 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  welcome: { fontSize: 20, marginBottom: 30 },
});