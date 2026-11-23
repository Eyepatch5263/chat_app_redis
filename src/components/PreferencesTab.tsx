"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "./ui/button"
import { Bell, BellOff, Moon, Sun, Volume2, VolumeX, SlidersHorizontal } from "lucide-react"
import { useTheme } from "next-themes"
import { usePreferences } from "@/store/usePrefrences"
import { useSound } from "use-sound"
import { onMessage, getToken, deleteToken } from "firebase/messaging"
import { getBrowserMessaging, getFirebaseWebConfig } from "@/lib/firebase-client"
import { registerPushTokenAction, unregisterPushTokenAction } from "@/actions/push.actions"

const PUSH_OPT_OUT_KEY = "chatie-push-opt-out"
const PUSH_OPT_IN_KEY = "chatie-push-opt-in"

type PushState = "checking" | "unsupported" | "off" | "on" | "error"

const PreferencesTab = () => {
  const { setTheme } = useTheme()
  const { soundEnabled, setSoundEnabled } = usePreferences()
  const [pushState, setPushState] = useState<PushState>("checking")
  const [pushMessage, setPushMessage] = useState("")
  const [pushBusy, setPushBusy] = useState(false)
  const [playMouseClick] = useSound("/sounds/mouse-click.mp3")
  const [playSoundOn] = useSound("/sounds/sound-on.mp3", { volume: 0.5 })
  const [playSoundOff] = useSound("/sounds/sound-off.mp3", { volume: 0.5 })

  const toggleSound = () => {
    soundEnabled ? playSoundOff() : playSoundOn()
    setSoundEnabled(!soundEnabled)
  }

  const registerCurrentBrowser = useCallback(async (askPermission: boolean) => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushState("unsupported")
      setPushMessage("This browser does not support web push notifications.")
      return false
    }

    let permission = Notification.permission
    if (permission !== "granted" && askPermission) permission = await Notification.requestPermission()
    if (permission !== "granted") {
      setPushState("off")
      setPushMessage(permission === "denied"
        ? "Notifications are blocked for this site. Open the browser's site settings, allow notifications, then try again."
        : "Notifications were not allowed. Tap Message notifications and choose Allow to continue.")
      return false
    }

    // Keep the browser permission prompt above all network/config awaits: browsers
    // require it to happen directly inside the user's click gesture.
    const webConfig = await getFirebaseWebConfig()
    if (!webConfig) {
      setPushState("error")
      setPushMessage("Push notifications are not configured on the app server yet.")
      return false
    }

    const messaging = await getBrowserMessaging()
    if (!messaging) {
      setPushState("unsupported")
      setPushMessage("This browser cannot receive Firebase notifications.")
      return false
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" })
    const token = await getToken(messaging, {
      vapidKey: webConfig.vapidKey,
      serviceWorkerRegistration: registration,
    })
    if (!token) {
      setPushState("error")
      setPushMessage("Could not register this device for notifications.")
      return false
    }

    const result = await registerPushTokenAction(token)
    if (!result.success) {
      setPushState("error")
      setPushMessage(result.message || "Push delivery could not be enabled on the server.")
      return false
    }

    window.localStorage.setItem(PUSH_OPT_IN_KEY, "true")
    window.localStorage.removeItem(PUSH_OPT_OUT_KEY)
    setPushState("on")
    setPushMessage("This device will receive new message notifications.")
    return true
  }, [])

  useEffect(() => {
    let active = true
    let stopListening: (() => void) | undefined

    const initializePush = async () => {
      if (window.localStorage.getItem(PUSH_OPT_OUT_KEY) === "true" || window.localStorage.getItem(PUSH_OPT_IN_KEY) !== "true") {
        if (active) setPushState("off")
        return
      }
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        if (active) setPushState("unsupported")
        return
      }
      if (Notification.permission !== "granted" || !(await getFirebaseWebConfig())) {
        if (active) setPushState("off")
        return
      }

      try {
        const registered = await registerCurrentBrowser(false)
        if (!registered || !active) return
        const messaging = await getBrowserMessaging()
        if (!messaging) return
        stopListening = onMessage(messaging, async (payload) => {
          const data = payload.data || {}
          const title = data.title || "New message on Chatie"
          const registration = await navigator.serviceWorker.getRegistration("/")
          if (registration) {
            await registration.showNotification(title, {
              body: data.body || "You have a new message",
              icon: "/chatie-notification.png",
              badge: "/chatie-notification-badge.png",
              data: { link: data.link || "/" },
              tag: data.conversationId ? `chatie-${data.conversationId}` : undefined,
            })
          }
        })
      } catch (error) {
        if (active) {
          setPushState("error")
          setPushMessage(error instanceof Error ? error.message : "Could not initialize notifications.")
        }
      }
    }

    void initializePush()
    return () => {
      active = false
      stopListening?.()
    }
  }, [registerCurrentBrowser])

  const togglePush = async () => {
    setPushBusy(true)
    setPushMessage("")
    try {
      if (pushState === "on") {
        window.localStorage.setItem(PUSH_OPT_OUT_KEY, "true")
        window.localStorage.removeItem(PUSH_OPT_IN_KEY)
        const messaging = await getBrowserMessaging()
        if (messaging) {
          const webConfig = await getFirebaseWebConfig()
          const token = webConfig ? await getToken(messaging, { vapidKey: webConfig.vapidKey }) : null
          if (token) await unregisterPushTokenAction(token)
          await deleteToken(messaging)
        }
        setPushState("off")
        setPushMessage("Notifications are off for this device.")
      } else {
        window.localStorage.removeItem(PUSH_OPT_OUT_KEY)
        window.localStorage.removeItem(PUSH_OPT_IN_KEY)
        await registerCurrentBrowser(true)
      }
    } catch (error) {
      setPushState("error")
      setPushMessage(error instanceof Error ? error.message : "Could not update notification settings.")
    } finally {
      setPushBusy(false)
    }
  }

  return <details className="preferences-menu">
    <summary className="icon-button preferences-trigger" aria-label="Preferences" title="Preferences"><SlidersHorizontal size={17}/></summary>
    <div className="preferences-panel">
      <p className="preferences-label">APPEARANCE</p>
      <div className="theme-options">
        <Button variant="outline" size="sm" className="preference-option" onClick={() => { soundEnabled && playMouseClick(); setTheme("light") }}><Sun size={15}/> Light</Button>
        <Button variant="outline" size="sm" className="preference-option" onClick={() => { soundEnabled && playMouseClick(); setTheme("dark") }}><Moon size={15}/> Dark</Button>
      </div>
      <div className="preferences-divider"/>
      <button className="sound-option" onClick={toggleSound} aria-pressed={soundEnabled}>{soundEnabled ? <Volume2 size={16}/> : <VolumeX size={16}/>}<span>Interface sounds</span><span className={`sound-state ${soundEnabled ? 'sound-on' : ''}`}>{soundEnabled ? 'On' : 'Off'}</span></button>
      <button className="sound-option" onClick={togglePush} disabled={pushBusy || pushState === "checking" || pushState === "unsupported"} aria-pressed={pushState === "on"}>
        {pushState === "on" ? <Bell size={16}/> : <BellOff size={16}/>}
        <span>Message notifications</span>
        <span className={`sound-state ${pushState === "on" ? "sound-on" : ""}`}>{pushBusy ? "…" : pushState === "on" ? "On" : pushState === "checking" ? "…" : "Off"}</span>
      </button>
      {pushMessage && <p className={`push-status ${pushState === "error" ? "push-status-error" : ""}`} role="status">{pushMessage}</p>}
    </div>
  </details>
}

export default PreferencesTab
