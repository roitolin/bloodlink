import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, initializeFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const requireEnv = (...names: string[]): string => {
  const value = names.map((name) => import.meta.env[name]).find((item) => typeof item === 'string' && item.length > 0)
  if (!value) {
    throw new Error(`Missing required environment variable: ${names.join(' or ')}`)
  }
  return value
}

const firebaseConfig = {
  apiKey: requireEnv('VITE_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_API_KEY'),
  authDomain: requireEnv('VITE_FIREBASE_AUTH_DOMAIN', 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'),
  projectId: requireEnv('VITE_FIREBASE_PROJECT_ID', 'EXPO_PUBLIC_FIREBASE_PROJECT_ID'),
  storageBucket: requireEnv('VITE_FIREBASE_STORAGE_BUCKET', 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requireEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requireEnv('VITE_FIREBASE_APP_ID', 'EXPO_PUBLIC_FIREBASE_APP_ID'),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || import.meta.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || undefined,
}

const hasExistingApp = getApps().length > 0
const app = hasExistingApp ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = hasExistingApp
  ? getFirestore(app)
  : initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
    })
export const storage = getStorage(app)
