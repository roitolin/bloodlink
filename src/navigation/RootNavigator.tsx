import { NavigationContainer } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { navigationTheme } from "../theme";
import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";
import AdminStackNavigator from "./AdminStackNavigator";
import VerificationStackNavigator from "./VerificationStackNavigator";

export default function RootNavigator() {
  const { user, role, loading } = useAuth();
  const navigationKey = user?.uid ? `auth-${user.uid}-${role || "user"}` : "guest";

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: navigationTheme.colors.background }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer key={navigationKey} theme={navigationTheme}>
      {!user && <AuthNavigator />}
      {user && !user.emailVerified && <VerificationStackNavigator />}
      {user && user.emailVerified && role === "admin" && <AdminStackNavigator />}
      {user && user.emailVerified && role !== "admin" && <MainNavigator />}
    </NavigationContainer>
  );
}
