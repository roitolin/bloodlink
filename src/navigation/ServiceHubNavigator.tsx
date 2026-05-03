import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainNavigator from "./MainNavigator";
import FuneralNavigator from "./FuneralNavigator";
import { AccountSettingsScreen, ServiceHubScreen } from "@/pages/shared";

const Stack = createNativeStackNavigator();

export default function ServiceHubNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ServiceHub" component={ServiceHubScreen} />
      <Stack.Screen name="AccountSettings" component={AccountSettingsScreen} />
      <Stack.Screen name="BloodLinkApp" component={MainNavigator} />
      <Stack.Screen name="FuneralApp" component={FuneralNavigator} />
    </Stack.Navigator>
  );
}
