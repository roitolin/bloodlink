import { PropsWithChildren } from "react";
import { Provider as PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, SidebarProvider } from "@/context";
import { theme } from "@/theme";

export default function AppProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <SidebarProvider>
          <AuthProvider>{children}</AuthProvider>
        </SidebarProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
