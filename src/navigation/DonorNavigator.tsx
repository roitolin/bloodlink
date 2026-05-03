import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Button } from "react-native";
import { DonorDashboard, DonorProfileScreen } from "@/pages/user";
import { MapLocationPickerScreen } from "@/pages/shared";

const Stack = createNativeStackNavigator();

export default function DonorNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="DonorDashboard"
        component={DonorDashboard}
        options={({ navigation }) => ({
          title: "Dashboard",
          headerRight: () => (
            <Button title="Choices" onPress={() => navigation.getParent?.()?.getParent?.()?.navigate("ServiceHub")} color="#b91c1c" />
          ),
        })}
      />
      <Stack.Screen
        name="DonorProfile"
        component={DonorProfileScreen}
        options={({ navigation }) => ({
          title: "Donor Application",
          headerRight: () => (
            <Button title="Choices" onPress={() => navigation.getParent?.()?.getParent?.()?.navigate("ServiceHub")} color="#b91c1c" />
          ),
        })}
      />
      <Stack.Screen name="MapLocationPicker" component={MapLocationPickerScreen} options={{ title: "Pin Location" }} />
    </Stack.Navigator>
  );
}
