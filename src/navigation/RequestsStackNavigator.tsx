import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "react-native-paper";
import { CreateRequestScreen, MyRequestsScreen, RequestDetailScreen } from "@/pages/user";
import { DisputeReportScreen, MapLocationPickerScreen } from "@/pages/shared";

const Stack = createNativeStackNavigator();

export default function RequestsStackNavigator() {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.primary },
        headerTintColor: "#fff",
        headerShown: true,
      }}
    >
      <Stack.Screen name="MyRequests" component={MyRequestsScreen} options={{ title: "My Requests" }} />
      <Stack.Screen name="RequestDetail" component={RequestDetailScreen} options={{ title: "Request Details" }} />
      <Stack.Screen name="ReportCenter" component={DisputeReportScreen} options={{ title: "Report Center" }} />
      <Stack.Screen name="CreateRequest" component={CreateRequestScreen} options={{ title: "Create Request" }} />
      <Stack.Screen name="MapLocationPicker" component={MapLocationPickerScreen} options={{ title: "Pin Location" }} />
    </Stack.Navigator>
  );
}

