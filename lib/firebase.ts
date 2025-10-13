import { initializeApp, getApps, getApp, type FirebaseOptions } from "firebase/app"
import { getAuth } from "firebase/auth"
import {
  getFirestore,
  initializeFirestore,
  enableIndexedDbPersistence,
  enableMultiTabIndexedDbPersistence,
} from "firebase/firestore"
import { getStorage } from "firebase/storage"

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const missingConfigKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key)

if (missingConfigKeys.length > 0 && typeof window !== "undefined") {
  console.warn(
    `Missing Firebase configuration values for: ${missingConfigKeys.join(", ")}\. ` +
      "Firebase features will not work until environment variables are provided."
  )
}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()

let dbInstance

if (typeof window !== "undefined") {
  try {
    dbInstance = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      cacheSizeBytes: 40 * 1024 * 1024,
    })
  } catch {
    dbInstance = getFirestore(app)
  }

  void (async () => {
    try {
      await enableMultiTabIndexedDbPersistence(dbInstance)
      if (process.env.NODE_ENV !== "production") {
        console.info("Firestore persistence enabled (multi-tab)")
      }
    } catch (multiTabError) {
      try {
        await enableIndexedDbPersistence(dbInstance)
        if (process.env.NODE_ENV !== "production") {
          console.info("Firestore persistence enabled (single-tab)")
        }
      } catch (persistenceError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Firestore persistence unavailable", persistenceError ?? multiTabError)
        }
      }
    }
  })()
} else {
  dbInstance = getFirestore(app)
}

export const auth = getAuth(app)
export const db = dbInstance
export const storage = getStorage(app)
