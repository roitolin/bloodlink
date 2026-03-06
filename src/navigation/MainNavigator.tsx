import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { TouchableOpacity, Text, Alert } from "react-native";
import { useAuth } from "../context/AuthContext";
import DashboardScreen from "../screens/DashboardScreen";
import SearchDonorsScreen from "../screens/SearchDonorsScreen";
import RequestsStackNavigator from "./RequestsStackNavigator";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();

// Header logout button component
function HeaderLogoutButton() {
  const { logout } = useAuth();
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error: any) {
      Alert.alert("Logout Failed", error.message);
    }
  };
  return (
    <TouchableOpacity onPress={handleLogout} style={{ marginRight: 15 }}>
      <Text style={{ color: "red", fontSize: 16 }}>Logout</Text>
    </TouchableOpacity>
  );
}

export default function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;
          if (route.name === "Home") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Search") {
            iconName = focused ? "search" : "search-outline";
          } else if (route.name === "Requests") {
            iconName = focused ? "list" : "list-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          } else {
            iconName = "help-outline";
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "red",
        tabBarInactiveTintColor: "gray",
        headerShown: true,
      })}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          title: "Dashboards",
          headerRight: () => <HeaderLogoutButton />,
        }}
      />
      <Tab.Screen name="Search" component={SearchDonorsScreen} options={{ title: "Find Donors" }} />
      <Tab.Screen
        name="Requests"
        component={RequestsStackNavigator}
        options={{ title: "My Requests", headerShown: false }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Tab.Navigator>
  );
}