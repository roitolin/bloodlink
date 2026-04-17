import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyDT7eSQfY5nB86XvEHTxg3t_mvbwaETUXI",
  authDomain: "bloodlink-7b8eb.firebaseapp.com",
  projectId: "bloodlink-7b8eb",
  storageBucket: "bloodlink-7b8eb.firebasestorage.app",
  messagingSenderId: "570965616445",
  appId: "1:570965616445:web:d42e175ac14714dde18754",
  measurementId: "G-ENZMK3LY2P"
};

const app = initializeApp(firebaseConfig);
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

export const db = getFirestore(app);
