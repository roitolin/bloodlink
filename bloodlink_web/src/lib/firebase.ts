import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyDT7eSQfY5nB86XvEHTxg3t_mvbwaETUXI',
  authDomain: 'bloodlink-7b8eb.firebaseapp.com',
  projectId: 'bloodlink-7b8eb',
  storageBucket: 'bloodlink-7b8eb.firebasestorage.app',
  messagingSenderId: '570965616445',
  appId: '1:570965616445:web:d42e175ac14714dde18754',
  measurementId: 'G-ENZMK3LY2P',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

