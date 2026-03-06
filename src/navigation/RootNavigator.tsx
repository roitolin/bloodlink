import { NavigationContainer } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";
import AdminNavigator from "./AdminNavigator";

export default function RootNavigator() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user && <AuthNavigator />}
      {user && role === "admin" && <AdminNavigator />}
      {user && role !== "admin" && <MainNavigator />}
    </NavigationContainer>
  );
}