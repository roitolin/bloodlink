import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  AdminAllDonorsScreen,
  AdminAnalyticsScreen,
  AdminAnnouncementsScreen,
  AdminAuditLogsScreen,
  AdminDashboard,
  AdminManagementScreen,
  AdminModerationScreen,
  AdminMoreScreen,
  AdminSupportMessages,
  AdminUsersScreen,
} from "@/pages/admin";
import { AppFeedbackScreen } from "@/pages/shared";
import {
  useAdminManagementBreakdownCount,
  useAdminNotificationCount,
  useUnreadSupportCount,
} from "@/hooks";

const Tab = createBottomTabNavigator();

function NotificationBell() {
  const navigation = useNavigation<any>();
  const unreadCount = useAdminNotificationCount();

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate("Notifications")}
      style={{ marginRight: 15 }}
    >
      <View>
        <Ionicons name="notifications-outline" size={24} color="white" />
        {unreadCount > 0 && (
          <View style={styles.badgeWrap}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? "9+" : unreadCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function HeaderBackToMore({ onPress, label = "" }: { onPress: () => void; label?: string }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.headerBackButton}>
      <Ionicons name="chevron-back" size={18} color="white" />
      {label ? <Text style={styles.headerBackText}>{label}</Text> : null}
    </TouchableOpacity>
  );
}

function TabIcon({ name, color, size, badgeCount }: any) {
  return (
    <View>
      <Ionicons name={name} size={size} color={color} />
      {badgeCount > 0 && (
        <View style={styles.badgeWrap}>
          <Text style={styles.badgeText}>
            {badgeCount > 9 ? "9+" : badgeCount}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function AdminTabsNavigator() {
  const unreadSupportCount = useUnreadSupportCount();
  const { donors: pendingDonorCount, requests: pendingRequestCount } = useAdminManagementBreakdownCount();

  const hiddenTabOptions = {
    tabBarButton: () => null,
    tabBarItemStyle: { display: "none" as const },
  };

  const hiddenWithBack = (navigation: any, title: string, label = "") => ({
    title,
    ...hiddenTabOptions,
    headerLeft: () => <HeaderBackToMore onPress={() => navigation.navigate("More")} label={label} />,
  });

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;
          let badgeCount = 0;

          if (route.name === "Dashboard") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Management") {
            iconName = focused ? "list" : "list-outline";
            badgeCount = pendingRequestCount;
          } else if (route.name === "Donors") {
            iconName = focused ? "water" : "water-outline";
            badgeCount = pendingDonorCount;
          } else if (route.name === "Users") {
            iconName = focused ? "people" : "people-outline";
          } else if (route.name === "More") {
            iconName = focused ? "ellipsis-horizontal-circle" : "ellipsis-horizontal-circle-outline";
            badgeCount = unreadSupportCount;
          } else if (route.name === "Analytics") {
            iconName = focused ? "bar-chart" : "bar-chart-outline";
          } else if (route.name === "Feedback") {
            iconName = focused ? "star" : "star-outline";
          } else if (route.name === "Support") {
            iconName = focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline";
            badgeCount = unreadSupportCount;
          } else if (route.name === "Moderation") {
            iconName = focused ? "shield-checkmark" : "shield-checkmark-outline";
          } else if (route.name === "Announcements") {
            iconName = focused ? "megaphone" : "megaphone-outline";
          } else if (route.name === "AuditLogs") {
            iconName = focused ? "document-text" : "document-text-outline";
          } else {
            iconName = "help-outline";
          }

          return (
            <TabIcon
              name={iconName}
              color={color}
              size={size}
              badgeCount={badgeCount}
            />
          );
        },
        tabBarActiveTintColor: "red",
        tabBarInactiveTintColor: "gray",
        headerRight: () => <NotificationBell />,
        headerStyle: { backgroundColor: "#d32f2f" },
        headerTintColor: "white",
      })}
    >
      <Tab.Screen name="Dashboard" component={AdminDashboard} options={{ title: "Dashboard" }} />
      <Tab.Screen name="Management" component={AdminManagementScreen} options={{ title: "Requests" }} />
      <Tab.Screen name="Donors" component={AdminAllDonorsScreen} options={{ title: "Donors" }} />
      <Tab.Screen name="Users" component={AdminUsersScreen} options={{ title: "Users" }} />
      <Tab.Screen name="More" component={AdminMoreScreen} options={{ title: "More" }} />

      <Tab.Screen
        name="Analytics"
        component={AdminAnalyticsScreen}
        options={({ navigation }) => hiddenWithBack(navigation, "Analytics")}
      />
      <Tab.Screen
        name="Moderation"
        component={AdminModerationScreen}
        options={({ navigation }) => hiddenWithBack(navigation, "Moderation")}
      />
      <Tab.Screen
        name="Announcements"
        component={AdminAnnouncementsScreen}
        options={({ navigation }) => hiddenWithBack(navigation, "Announcements")}
      />
      <Tab.Screen
        name="Feedback"
        component={AppFeedbackScreen}
        options={({ navigation }) => hiddenWithBack(navigation, "Rate & Feedback")}
      />
      <Tab.Screen
        name="Support"
        component={AdminSupportMessages}
        options={({ navigation }) => hiddenWithBack(navigation, "Support Inbox")}
      />
      <Tab.Screen
        name="AuditLogs"
        component={AdminAuditLogsScreen}
        options={({ navigation }) => hiddenWithBack(navigation, "Audit Logs", "")}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  badgeWrap: {
    position: "absolute",
    right: -6,
    top: -3,
    backgroundColor: "red",
    borderRadius: 10,
    width: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  headerBackButton: {
    marginLeft: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 6,
    paddingRight: 8,
  },
  headerBackText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
  },
});
