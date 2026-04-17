import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Button, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";
import { RequesterDashboard } from "@/pages/user";
import { confirmLogout } from "../utils/logoutConfirmation";

const Stack = createNativeStackNavigator();

export default function RequesterNavigator() {
  const { logout } = useAuth();
  const handleLogout = () => {
    confirmLogout({
      logout,
      onError: (error: any) => {
        Alert.alert("Logout Failed", error?.message || "Failed to logout.");
      },
    });
  };

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="RequesterDashboard"
        component={RequesterDashboard}
        options={{
          title: "Dashboard",
          headerRight: () => <Button title="Logout" onPress={handleLogout} color="red" />,
        }}
      />
    </Stack.Navigator>
  );
}
