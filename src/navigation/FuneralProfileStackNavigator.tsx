import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  AboutUsScreen,
  ContactScreen,
  DonationHistoryScreen,
} from "@/pages/user";
import {
  AppFeedbackScreen,
  ChatScreen,
  DisputeReportScreen,
  DonorDetailScreen,
  MapLocationPickerScreen,
} from "@/pages/shared";
import FuneralBusinessInformationScreen from "@/screens/funeral/FuneralBusinessInformationScreen";
import FuneralMyServiceRequestsScreen from "@/screens/funeral/FuneralMyServiceRequestsScreen";
import FuneralProductEditorScreen from "@/screens/funeral/FuneralProductEditorScreen";
import FuneralProfileScreen from "@/screens/funeral/FuneralProfileScreen";
import FuneralServiceRequestsInboxScreen from "@/screens/funeral/FuneralServiceRequestsInboxScreen";
import FuneralShopCenterScreen from "@/screens/funeral/FuneralShopCenterScreen";
import FuneralShopInformationScreen from "@/screens/funeral/FuneralShopInformationScreen";

const Stack = createNativeStackNavigator();

export default function FuneralProfileStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: "#f8f6f2",
        },
        headerTintColor: "#22312d",
        headerShadowVisible: false,
        headerTitleStyle: {
          color: "#22312d",
          fontWeight: "700",
        },
        contentStyle: {
          backgroundColor: "#eef1ec",
        },
      }}
    >
      <Stack.Screen name="ProfileMain" component={FuneralProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="ShopInformation" component={FuneralShopInformationScreen} options={{ title: "Shop Information" }} />
      <Stack.Screen name="BusinessInformation" component={FuneralBusinessInformationScreen} options={{ title: "Business Information" }} />
      <Stack.Screen name="ShopCenter" component={FuneralShopCenterScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProductEditor" component={FuneralProductEditorScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ServiceRequestsInbox" component={FuneralServiceRequestsInboxScreen} options={{ title: "Service Requests" }} />
      <Stack.Screen name="MyServiceRequests" component={FuneralMyServiceRequestsScreen} options={{ title: "My Service Requests" }} />
      <Stack.Screen name="Contact" component={ContactScreen} options={{ title: "Contact Support" }} />
      <Stack.Screen name="SupportChat" component={ChatScreen} options={{ title: "Support Chat" }} />
      <Stack.Screen name="DonorDetail" component={DonorDetailScreen} options={{ title: "Profile Details" }} />
      <Stack.Screen name="AppFeedback" component={AppFeedbackScreen} options={{ title: "Rate & Feedback" }} />
      <Stack.Screen name="DonationHistory" component={DonationHistoryScreen} options={{ title: "Donation History" }} />
      <Stack.Screen name="ReportCenter" component={DisputeReportScreen} options={{ title: "Report Center" }} />
      <Stack.Screen name="AboutUs" component={AboutUsScreen} options={{ title: "About Us" }} />
      <Stack.Screen name="MapLocationPicker" component={MapLocationPickerScreen} options={{ title: "Pin Location" }} />
    </Stack.Navigator>
  );
}
