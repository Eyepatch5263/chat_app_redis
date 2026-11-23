import { getApp, getApps, initializeApp } from "firebase/app"
import { getMessaging, isSupported, type Messaging } from "firebase/messaging"

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
}

export function hasFirebaseWebConfig() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId &&
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  )
}

export async function getBrowserMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined" || !hasFirebaseWebConfig()) return null
  if (!(await isSupported())) return null

  const appName = "chat-app"
  const app = getApps().some((existing) => existing.name === appName)
    ? getApp(appName)
    : initializeApp(firebaseConfig, appName)

  return getMessaging(app)
}

export const firebaseVapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
