import { NavigationContainer } from "@react-navigation/native";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { navigationTheme } from "../theme";
import AuthNavigator from "./AuthNavigator";
import AdminStackNavigator from "./AdminStackNavigator";
import VerificationStackNavigator from "./VerificationStackNavigator";
import ServiceHubNavigator from "./ServiceHubNavigator";

export default function RootNavigator() {
  const { user, role, loading } = useAuth();
  const navigationKey = user?.uid ? `auth-${user.uid}-${role || "user"}` : "guest";
  const isAdminRole = role === "super_admin" || role === "admin" || role === "blood_admin" || role === "funeral_admin";

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
      {user && user.emailVerified && isAdminRole && <AdminStackNavigator />}
      {user && user.emailVerified && !isAdminRole && <ServiceHubNavigator />}
    </NavigationContainer>
  );
}
