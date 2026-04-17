import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AdminTabsNavigator from "./AdminTabsNavigator";
import { AdminUserDetailScreen } from "@/pages/admin";
import { ChatScreen, DonorDetailScreen, NotificationsScreen } from "@/pages/shared";
import { RequestDetailScreen } from "@/pages/user";

const Stack = createNativeStackNavigator();

export default function AdminStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="AdminTabs"
        component={AdminTabsNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: "Support Chat" }}
      />
      <Stack.Screen
        name="DonorDetail"
        component={DonorDetailScreen}
        options={{ title: "Donor Profile" }}
      />
      <Stack.Screen
        name="AdminUserDetail"
        component={AdminUserDetailScreen}
        options={{ title: "User Details" }}
      />
      <Stack.Screen
        name="RequestDetail"
        component={RequestDetailScreen}
        options={{ title: "Request Details" }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: "Notifications" }}
      />
    </Stack.Navigator>
  );
}
