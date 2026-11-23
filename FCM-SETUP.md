# Firebase Cloud Messaging setup

Chatie's browser push notifications require Firebase web-app settings, a Web Push VAPID public key, and a Firebase Admin service-account credential. Push delivery remains inactive until all required settings are added to the server deployment environment. Do not commit secrets or place a service-account credential in a `NEXT_PUBLIC_` variable.

## 1. Configure Firebase

1. Create or select a Firebase project and add a **Web app**. Copy its Firebase web configuration values.
2. In Firebase Console, open **Project settings → Cloud Messaging** and generate a **Web Push certificates** key pair. Use its public key as the VAPID key.
3. In **Project settings → Service accounts**, create/download a private service-account JSON key for the same project. Treat this file as a secret; never check it into Git.
4. Enable Firebase Cloud Messaging for the project if prompted by the Console.

## 2. Set deployment environment variables

Set these variables in the hosting provider's environment configuration, then redeploy the app:

```text
NEXT_PUBLIC_FIREBASE_API_KEY=<Firebase web app apiKey>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<Firebase web app authDomain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<Firebase project ID>
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=<Firebase web app storageBucket>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<Firebase web app messagingSenderId>
NEXT_PUBLIC_FIREBASE_APP_ID=<Firebase web app appId>
NEXT_PUBLIC_FIREBASE_VAPID_KEY=<Web Push certificates public key>
FCM_SERVICE_ACCOUNT_JSON=<complete service-account JSON object>
```

`FCM_SERVICE_ACCOUNT_JSON` must contain the full downloaded JSON object, including `project_id`, `client_email`, and `private_key`. Configure it as a protected server-side secret. The service-account project ID must match `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. The storage bucket value is included for completeness; browser messaging does not otherwise use Firebase Storage.

The `NEXT_PUBLIC_` values are public Firebase client configuration, not service-account secrets. They are delivered to the browser and embedded in the dynamic service-worker response. Never put a private key, service-account JSON, or other credential in a `NEXT_PUBLIC_` variable.

## 3. Browser behavior

Users enable notifications explicitly from **Preferences → Message notifications**. The browser asks for notification permission only after this click. Permission can also be denied in the browser's site settings. Users can turn notifications off from the same control; this removes the current browser token from Chatie and stores an opt-out on that browser.

The app registers `/firebase-messaging-sw.js` at the origin root for background notifications. Firebase Web Messaging requires a secure context: use HTTPS in deployment, or `localhost` during development. Browser and device support varies; in particular, mobile browsers may require the app to be installed or may not support Web Push.

After setup, a successful opt-in registers the signed-in user's token in Upstash Redis. When that user receives a message, the server sends the push after message persistence. Text messages show a short preview; image, video, and PDF messages show a type label. Expired tokens are removed automatically. If Firebase Admin configuration is missing, rejected, or unavailable, the persisted message still succeeds and the live Socket.IO relay remains independent.

## Troubleshooting

- **Push notifications are not configured:** Verify all client variables and `FCM_SERVICE_ACCOUNT_JSON` are present in the environment for the deployed server, then redeploy.
- **Permission denied:** Change notification permission for the site's origin in browser settings, then re-enable in Chatie.
- **No background notification:** Confirm the site is served over HTTPS, the Firebase project/VAPID key match, and `/firebase-messaging-sw.js` is served from the same origin with status 200.
- **Foreground notification is missing:** Keep the app signed in, allow notifications, and check that the browser supports Firebase Messaging.
