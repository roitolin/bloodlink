import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AdminDashboard from "../screens/AdminDashboard";

const Stack = createNativeStackNavigator();

export default function AdminNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="AdminDashboard" 
        component={AdminDashboard} 
        options={{ title: "Admin Panel" }} 
      />
      {/* Add more admin screens here later */}
    </Stack.Navigator>
  );
}