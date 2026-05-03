import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  AboutUsScreen,
  ContactScreen,
  DonorProfileScreen,
  DonationHistoryScreen,
  ProfileScreen,
} from "@/pages/user";
import {
  AppFeedbackScreen,
  ChatScreen,
  DisputeReportScreen,
  DonorDetailScreen,
  MapLocationPickerScreen,
} from "@/pages/shared";

const Stack = createNativeStackNavigator();

export default function ProfileStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: "Profile" }} />
      <Stack.Screen name="DonorApplication" component={DonorProfileScreen} options={{ title: "Donor Application" }} />
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

