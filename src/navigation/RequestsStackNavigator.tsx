import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MyRequestsScreen from "../screens/MyRequestsScreen";
import CreateRequestScreen from "../screens/CreateRequestScreen";

const Stack = createNativeStackNavigator();

export default function RequestsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MyRequests"
        component={MyRequestsScreen}
        options={{ title: "My Requests" }}
      />
      <Stack.Screen
        name="CreateRequest"
        component={CreateRequestScreen}
        options={{ title: "Create Request" }}
      />
    </Stack.Navigator>
  );
}