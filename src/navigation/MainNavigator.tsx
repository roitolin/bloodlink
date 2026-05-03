import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, Pressable } from "react-native";
import { useRef } from "react";
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
      <Ionicons name={name} size={size} color={color} />
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
  const lastTapByTabRef = useRef<Record<string, number>>({});

  const triggerTabRefresh = (navigation: any, tabName: string) => {
    const refreshToken = Date.now();

    if (tabName === "Feed") {
      navigation.navigate("Feed", {
        screen: "FeedMain",
        params: { refreshToken },
      });
      return;
    }

    if (tabName === "Search") {
      navigation.navigate("Search", {
        screen: "SearchDonors",
        params: { refreshToken },
      });
      return;
    }

    if (tabName === "Requests") {
      navigation.navigate("Requests", {
        screen: "MyRequests",
        params: { refreshToken },
      });
      return;
    }

    if (tabName === "Notifications") {
      navigation.navigate("Notifications", { refreshToken });
      return;
    }

    if (tabName === "Profile") {
      navigation.navigate("Profile", {
        screen: "ProfileMain",
        params: { refreshToken },
      });
    }
  };

  const tabs = [
    { name: "Feed", component: FeedStackNavigator, icon: "home-outline", activeIcon: "home", options: { title: "Feed", headerShown: false } },
    { name: "Search", component: SearchStackNavigator, icon: "search-outline", activeIcon: "search", options: { title: "Find Donors", headerShown: false } },
    { name: "Requests", component: RequestsStackNavigator, icon: "list-outline", activeIcon: "list", options: { title: "My Requests", headerShown: false } },
    { name: "Notifications", component: NotificationsScreen, icon: "notifications-outline", activeIcon: "notifications", badge: unreadCount, options: { title: "Notifications" } },
    { name: "Profile", component: ProfileStackNavigator, icon: "person-outline", activeIcon: "person", options: { title: "Profile", headerShown: false } },
  ];

  return (
    <BottomTab.Navigator
      screenOptions={({ route, navigation }) => {
        const tab = tabs.find((t) => t.name === route.name);
        const badgeCount = tab?.badge || 0;
        return {
          tabBarPosition: "bottom",
          tabBarShowLabel: true,
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon
              name={(focused ? tab?.activeIcon : tab?.icon) || "help-circle-outline"}
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
          headerRight: () => (
            <Pressable
              onPress={() => {
                (navigation as any).getParent?.()?.navigate("ServiceHub");
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: "#fff5f5",
                borderWidth: 1,
                borderColor: "#fecaca",
              }}
            >
              <Ionicons name="apps-outline" size={16} color="#b91c1c" />
              <Text style={{ color: "#b91c1c", fontSize: 12, fontWeight: "800" }}>Choices</Text>
            </Pressable>
          ),
        };
      }}
    >
      {tabs.map((tab) => (
        <BottomTab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={tab.options}
          listeners={({ navigation }) => ({
            tabPress: (event) => {
              const now = Date.now();
              const activeTab = navigation.getState().routes[navigation.getState().index]?.name;
              const isFocused = activeTab === tab.name;
              const lastTap = lastTapByTabRef.current[tab.name] || 0;
              const isDoubleTap = now - lastTap <= 420;
              lastTapByTabRef.current[tab.name] = now;

              if (!isFocused || !isDoubleTap) return;

              event.preventDefault();
              lastTapByTabRef.current[tab.name] = 0;
              triggerTabRefresh(navigation, tab.name);
            },
          })}
        />
      ))}
    </BottomTab.Navigator>
  );
}
