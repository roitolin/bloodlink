// Source - https://stackoverflow.com/a/77655332
// Posted by Edison Nkemande, modified by community. See post 'Timeline' for change history
// Retrieved 2026-03-06, License - CC BY-SA 4.0

import { Persistence, ReactNativeAsyncStorage } from "firebase/auth";

declare module "firebase/auth" {
  export declare function getReactNativePersistence(
    storage: ReactNativeAsyncStorage,
  ): Persistence;
}
