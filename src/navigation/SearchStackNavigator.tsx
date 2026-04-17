import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTheme } from "react-native-paper";
import { CreateRequestScreen, SearchDonorsScreen } from "@/pages/user";
import { MapLocationPickerScreen } from "@/pages/shared";

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
      <Stack.Screen name="CreateRequest" component={CreateRequestScreen} options={{ title: "Create Request" }} />
      <Stack.Screen name="MapLocationPicker" component={MapLocationPickerScreen} options={{ title: "Pin Location" }} />
    </Stack.Navigator>
  );
}
