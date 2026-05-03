import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "react-native-paper";
import { ChatScreen, DisputeReportScreen, DonorDetailScreen, MapLocationPickerScreen } from "@/pages/shared";
import { CreateRequestScreen, SearchDonorsScreen } from "@/pages/user";

const Stack = createNativeStackNavigator();

export default function SearchStackNavigator() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: "#fff",
        headerShown: true,
      }}
    >
      <Stack.Screen name="SearchDonors" component={SearchDonorsScreen} options={{ title: "Find Donors" }} />
      <Stack.Screen name="DonorDetail" component={DonorDetailScreen} options={{ title: "Donor Profile" }} />
      <Stack.Screen name="CreateRequest" component={CreateRequestScreen} options={{ title: "Create Request" }} />
      <Stack.Screen name="MapLocationPicker" component={MapLocationPickerScreen} options={{ title: "Pin Location" }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: "Chat" }} />
      <Stack.Screen name="ReportCenter" component={DisputeReportScreen} options={{ title: "Report Center" }} />
    </Stack.Navigator>
  );
}
