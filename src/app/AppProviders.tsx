import { PropsWithChildren } from "react";
import { Provider as PaperProvider } from "react-native-paper";

import { AuthProvider, SidebarProvider } from "@/context";
import { theme } from "@/theme";

export default function AppProviders({ children }: PropsWithChildren) {
  return (
    <PaperProvider theme={theme}>
      <SidebarProvider>
        <AuthProvider>{children}</AuthProvider>
      </SidebarProvider>
    </PaperProvider>
  );
}
