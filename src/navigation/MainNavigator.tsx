import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { View, Text } from "react-native";
import FeedStackNavigator from "./FeedStackNavigator";
import SearchStackNavigator from "./SearchStackNavigator";
import RequestsStackNavigator from "./RequestsStackNavigator";
import ProfileStackNavigator from "./ProfileStackNavigator";
import { NotificationsScreen } from "@/pages/shared";
import { useUnreadCount } from "@/hooks";

const BottomTab = createBottomTabNavigator();

function TabBarIcon({ name, focused, color, size, badgeCount }: any) {
  return (
    <View>
      <Ionicons name={focused ? name : `${name}-outline`} size={size} color={color} />
      {badgeCount > 0 && (
        <View
          style={{
            position: "absolute",
            right: -6,
            top: -3,
            backgroundColor: "red",
            borderRadius: 10,
            width: 16,
            height: 16,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontSize: 10, fontWeight: "bold" }}>
            {badgeCount > 9 ? "9+" : badgeCount}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function MainNavigator() {
  const unreadCount = useUnreadCount();

  const tabs = [
    { name: "Feed", component: FeedStackNavigator, icon: "home", options: { title: "Feed", headerShown: false } },
    { name: "Search", component: SearchStackNavigator, icon: "search", options: { title: "Find Donors", headerShown: false } },
    { name: "Requests", component: RequestsStackNavigator, icon: "list", options: { title: "My Requests", headerShown: false } },
    { name: "Notifications", component: NotificationsScreen, icon: "notifications", badge: unreadCount, options: { title: "Notifications" } },
    { name: "Profile", component: ProfileStackNavigator, icon: "person", options: { title: "Profile", headerShown: false } },
  ];

  return (
    <BottomTab.Navigator
      screenOptions={({ route }) => {
        const tab = tabs.find((t) => t.name === route.name);
        const badgeCount = tab?.badge || 0;
        return {
          tabBarPosition: "bottom",
          tabBarVariant: "uikit",
          tabBarShowLabel: true,
          tabBarLabelPosition: "below-icon",
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon
              name={tab?.icon || "help"}
              focused={focused}
              color={color}
              size={size}
              badgeCount={badgeCount}
            />
          ),
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: "#d32f2f",
          tabBarInactiveTintColor: "#667085",
          headerShown: true,
        };
      }}
    >
      {tabs.map((tab) => (
        <BottomTab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={tab.options}
        />
      ))}
    </BottomTab.Navigator>
  );
}
