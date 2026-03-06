import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Button } from "react-native";
import { useAuth } from "../context/AuthContext";
import DonorDashboard from "../screens/DonorDashboard";
import DonorProfileScreen from "../screens/DonorProfileScreen";

const Stack = createNativeStackNavigator();

export default function DonorNavigator() {
  const { logout } = useAuth();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DonorDashboard"
        component={DonorDashboard}
        options={{
          title: "Dashboard",
          headerRight: () => <Button title="Logout" onPress={logout} color="red" />,
        }}
      />
      <Stack.Screen
        name="DonorProfile"
        component={DonorProfileScreen}
        options={{
          title: "My Profile",
          headerRight: () => <Button title="Logout" onPress={logout} color="red" />,
        }}
      />
    </Stack.Navigator>
  );
}