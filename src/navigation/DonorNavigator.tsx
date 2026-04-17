import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Button, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";
import { DonorDashboard, DonorProfileScreen } from "@/pages/user";
import { confirmLogout } from "../utils/logoutConfirmation";

const Stack = createNativeStackNavigator();

export default function DonorNavigator() {
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
        name="DonorDashboard"
        component={DonorDashboard}
        options={{
          title: "Dashboard",
          headerRight: () => <Button title="Logout" onPress={handleLogout} color="red" />,
        }}
      />
      <Stack.Screen
        name="DonorProfile"
        component={DonorProfileScreen}
        options={{
          title: "My Profile",
          headerRight: () => <Button title="Logout" onPress={handleLogout} color="red" />,
        }}
      />
    </Stack.Navigator>
  );
}
