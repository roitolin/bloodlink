import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { getFocusedRouteNameFromRoute } from "@react-navigation/native";
import { View } from "react-native";
import { FuneralHomeScreen } from "@/pages/funeral";
import FuneralCartScreen from "@/screens/funeral/FuneralCartScreen";
import FuneralCheckoutScreen from "@/screens/funeral/FuneralCheckoutScreen";
import FuneralCustomCasketRequestScreen from "@/screens/funeral/FuneralCustomCasketRequestScreen";
import FuneralProductViewScreen from "@/screens/funeral/FuneralProductViewScreen";
import FuneralShopProductsScreen from "@/screens/funeral/FuneralShopProductsScreen";
import FuneralShopsScreen from "@/screens/funeral/FuneralShopsScreen";
import FuneralProfileStackNavigator from "./FuneralProfileStackNavigator";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabBarIcon({ name, color, size }: any) {
  return (
    <View>
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}

const tabIcon = (routeName: string, focused: boolean): keyof typeof Ionicons.glyphMap => {
  switch (routeName) {
    case "Home":
      return focused ? "home" : "home-outline";
    case "Shops":
      return focused ? "storefront" : "storefront-outline";
    case "Carts":
      return focused ? "cart" : "cart-outline";
    case "Profile":
      return focused ? "person" : "person-outline";
    default:
      return "ellipse-outline";
  }
};

function FuneralTabs() {
  const tabs = [
    { name: "Home", component: FuneralHomeScreen, icon: "home-outline", activeIcon: "home", options: { title: "Home" } },
    { name: "Shops", component: FuneralShopsScreen, icon: "storefront-outline", activeIcon: "storefront", options: { title: "Shops" } },
    { name: "Carts", component: FuneralCartScreen, icon: "cart-outline", activeIcon: "cart", options: { title: "Carts" } },
    { name: "Profile", component: FuneralProfileStackNavigator, icon: "person-outline", activeIcon: "person", options: { title: "Profile", headerShown: false } },
  ];

  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const tab = tabs.find((item) => item.name === route.name);

        return {
          tabBarPosition: "bottom",
          tabBarShowLabel: true,
          tabBarStyle: {
            backgroundColor: "#ffffff",
            borderTopWidth: 1,
            borderTopColor: "#ece7df",
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
          },
          tabBarIcon: ({ focused, color, size }) => (
            <TabBarIcon
              name={(focused ? tab?.activeIcon : tab?.icon) || tabIcon(route.name, focused)}
              color={color}
              size={size}
            />
          ),
          tabBarHideOnKeyboard: true,
          tabBarActiveTintColor: "#334155",
          tabBarInactiveTintColor: "#667085",
          headerShown: route.name !== "Home",
        };
      }}
    >
      {tabs.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={tab.component}
          options={({ route }) => {
            if (tab.name !== "Profile") {
              return tab.options;
            }

            const nestedRoute = getFocusedRouteNameFromRoute(route) ?? "ProfileMain";

            return {
              ...tab.options,
              tabBarStyle: nestedRoute === "ShopCenter" || nestedRoute === "ProductEditor" ? { display: "none" } : undefined,
            };
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

export default function FuneralNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FuneralTabs" component={FuneralTabs} />
      <Stack.Screen name="ProductView" component={FuneralProductViewScreen} />
      <Stack.Screen name="ShopProducts" component={FuneralShopProductsScreen} />
      <Stack.Screen name="FuneralCheckout" component={FuneralCheckoutScreen} options={{ headerShown: true, title: "Service Request" }} />
      <Stack.Screen name="FuneralCustomCasketRequest" component={FuneralCustomCasketRequestScreen} options={{ headerShown: true, title: "Custom Casket Request" }} />
    </Stack.Navigator>
  );
}
