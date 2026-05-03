import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "react-native-paper";
import { Image, TouchableOpacity, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  ChatScreen,
  ConversationsList,
  DisputeReportScreen,
  DonorDetailScreen,
} from "@/pages/shared";
import {
  AvailableRequestsScreen,
  FeedScreen,
  HowToDonateScreen,
  RequestDetailScreen,
} from "@/pages/user";

const Stack = createNativeStackNavigator();

export default function FeedStackNavigator() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: "#fff",
        headerShown: true,
      }}
    >
      <Stack.Screen
        name="FeedMain"
        component={FeedScreen}
        options={({ navigation }) => ({
          headerTitle: () => (
            <View style={styles.brandWrap}>
              <Image source={require("../../assets/Logo.png")} style={styles.brandLogo} />
              <Text style={styles.brandText}>LifeCycle</Text>
            </View>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("Conversations")}
              style={{ marginRight: 15 }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={24} color="white" />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen name="RequestDetail" component={RequestDetailScreen} options={{ title: "Request Details" }} />
      <Stack.Screen name="DonorDetail" component={DonorDetailScreen} options={{ title: "Donor Profile" }} />
      <Stack.Screen name="AvailableRequests" component={AvailableRequestsScreen} options={{ title: "Active Requests" }} />
      <Stack.Screen name="HowToDonate" component={HowToDonateScreen} options={{ title: "How to Donate" }} />
      <Stack.Screen name="Conversations" component={ConversationsList} options={{ title: "Messages" }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "Chat" }} />
      <Stack.Screen name="ReportCenter" component={DisputeReportScreen} options={{ title: "Report Center" }} />
    </Stack.Navigator>
  );
}

const styles = {
  brandWrap: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  brandLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fff",
  },
  brandText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800" as const,
    letterSpacing: 0.3,
  },
};

