import { RootNavigator } from "@/navigation";
import { AppProviders } from "@/app";

export default function App() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
