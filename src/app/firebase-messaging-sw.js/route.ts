import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

function getPublicFirebaseConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.FIREBASE_APP_ID,
  }
}

export async function GET() {
  const config = getPublicFirebaseConfig()
  const configured = Boolean(config.apiKey && config.projectId && config.messagingSenderId && config.appId)
  const source = configured ? `
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || "New message on Chatie";
  const options = {
    body: data.body || "You have a new message",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    data: { link: data.link || "/" },
    tag: data.conversationId ? "chatie-" + data.conversationId : undefined,
    renotify: true
  };
  return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data && event.notification.data.link ? event.notification.data.link : "/";
  const destination = new URL(link, self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
    for (const client of windowClients) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        if ("navigate" in client && client.url !== destination) client.navigate(destination);
        return client.focus();
      }
    }
    return clients.openWindow(destination);
  }));
});
` : `self.addEventListener("install", () => self.skipWaiting());\n`

  return new NextResponse(source, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "Service-Worker-Allowed": "/",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
