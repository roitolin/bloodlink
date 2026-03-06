import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Button } from "react-native";
import { useAuth } from "../context/AuthContext";
import RequesterDashboard from "../screens/RequesterDashboard";

const Stack = createNativeStackNavigator();

export default function RequesterNavigator() {
  const { logout } = useAuth();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="RequesterDashboard"
        component={RequesterDashboard}
        options={{
          title: "Dashboard",
          headerRight: () => <Button title="Logout" onPress={logout} color="red" />,
        }}
      />
    </Stack.Navigator>
  );
}