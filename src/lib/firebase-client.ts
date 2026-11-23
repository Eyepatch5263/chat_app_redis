import { getApp, getApps, initializeApp } from "firebase/app"
import { getMessaging, isSupported, type Messaging } from "firebase/messaging"

export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket?: string
  messagingSenderId: string
  appId: string
  vapidKey: string
}

let configPromise: Promise<FirebaseWebConfig | null> | undefined

export function getFirebaseWebConfig(): Promise<FirebaseWebConfig | null> {
  if (typeof window === "undefined") return Promise.resolve(null)
  if (!configPromise) {
    configPromise = fetch("/api/firebase-config", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null
        const result = await response.json() as {
          configured?: boolean
          config?: Omit<FirebaseWebConfig, "vapidKey">
          vapidKey?: string
        }
        if (
          !result.configured ||
          !result.config?.apiKey ||
          !result.config.authDomain ||
          !result.config.projectId ||
          !result.config.messagingSenderId ||
          !result.config.appId ||
          !result.vapidKey
        ) return null

        return { ...result.config, vapidKey: result.vapidKey }
      })
      .catch(() => null)
  }
  return configPromise
}

export async function hasFirebaseWebConfig() {
  return Boolean(await getFirebaseWebConfig())
}

export async function getBrowserMessaging(): Promise<Messaging | null> {
  if (typeof window === "undefined") return null
  const config = await getFirebaseWebConfig()
  if (!config || !(await isSupported())) return null

  const appName = "chat-app"
  const app = getApps().some((existing) => existing.name === appName)
    ? getApp(appName)
    : initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      }, appName)

  return getMessaging(app)
}
