import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Button } from "react-native";
import { RequesterDashboard } from "@/pages/user";

const Stack = createNativeStackNavigator();

export default function RequesterNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="RequesterDashboard"
        component={RequesterDashboard}
        options={({ navigation }) => ({
          title: "Dashboard",
          headerRight: () => (
            <Button title="Choices" onPress={() => navigation.getParent?.()?.getParent?.()?.navigate("ServiceHub")} color="#b91c1c" />
          ),
        })}
      />
    </Stack.Navigator>
  );
}
