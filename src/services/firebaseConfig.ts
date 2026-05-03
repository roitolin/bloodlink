import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseApiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
const firebaseAuthDomain = process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN;
const firebaseProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;
const firebaseStorageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
const firebaseMessagingSenderId = process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
const firebaseAppId = process.env.EXPO_PUBLIC_FIREBASE_APP_ID;

const firebaseConfig = {
  apiKey: firebaseApiKey,
  authDomain: firebaseAuthDomain,
  projectId: firebaseProjectId,
  storageBucket: firebaseStorageBucket,
  messagingSenderId: firebaseMessagingSenderId,
  appId: firebaseAppId,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
};

if (!firebaseApiKey || !firebaseAuthDomain || !firebaseProjectId || !firebaseStorageBucket || !firebaseMessagingSenderId || !firebaseAppId) {
  throw new Error("Missing required Firebase environment variables. Check .env and EXPO_PUBLIC_FIREBASE_* values.");
}

const hasExistingApp = getApps().length > 0;
const app = hasExistingApp ? getApp() : initializeApp(firebaseConfig);

const firestoreSettings = {
  // React Native / Expo Android can be sensitive to Firestore's default
  // transport selection, especially during dev reloads and on some networks.
  experimentalForceLongPolling: true,
  experimentalLongPollingOptions: {
    timeoutSeconds: 25,
  },
};

export const auth = hasExistingApp
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });

let firestoreInstance;

try {
  firestoreInstance = initializeFirestore(app, firestoreSettings);
} catch {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;
