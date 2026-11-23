# Firebase Cloud Messaging setup

Chatie browser push needs Firebase web-app settings, a Web Push VAPID public key, and a Firebase Admin service-account credential. The service account is private and must stay server-side. The browser only receives the public Firebase web configuration and VAPID key from `/api/firebase-config`; do not expose or commit the service-account JSON.

## 1. Configure Firebase

1. Create or select a Firebase project and add a **Web app**. Copy its web configuration values.
2. In Firebase Console, open **Project settings → Cloud Messaging → Web Push certificates** and generate/copy the public VAPID key.
3. In **Project settings → Service accounts**, create/download a new private service-account JSON key for the same project. Keep the file private.
4. Enable Firebase Cloud Messaging for the project if prompted.

## 2. Set deployment environment variables

Prefer the unprefixed, server-side names below. The app sends only the whitelisted Firebase web settings and public VAPID key to the browser; it never sends `FCM_SERVICE_ACCOUNT_JSON` or its base64 alternative from `/api/firebase-config`.

```text
FIREBASE_API_KEY=<Firebase web app apiKey>
FIREBASE_AUTH_DOMAIN=<Firebase web app authDomain>
FIREBASE_PROJECT_ID=<Firebase project ID>
FIREBASE_STORAGE_BUCKET=<Firebase web app storageBucket>
FIREBASE_MESSAGING_SENDER_ID=<Firebase web app messagingSenderId>
FIREBASE_APP_ID=<Firebase web app appId>
FIREBASE_VAPID_KEY=<Web Push certificates public key>
FCM_SERVICE_ACCOUNT_JSON=<base64 of the complete service-account JSON file>
```

`FCM_SERVICE_ACCOUNT_JSON` accepts either the complete raw JSON document or the base64-encoded contents of that document. The recommended base64 value can stay under the existing `FCM_SERVICE_ACCOUNT_JSON` name; the parser automatically detects and decodes it. On Linux, create it with `base64 -w 0 service-account.json`. On macOS, use `base64 < service-account.json | tr -d '\n'`. As an optional alias, `FCM_SERVICE_ACCOUNT_JSON_BASE64` is also accepted.

If using a local `.env`, do not write an unquoted multi-line object after `FCM_SERVICE_ACCOUNT_JSON=`: dotenv reads only the first line, leaving a truncated `{` that cannot be parsed. Use the base64 value under the same variable name, or put complete raw JSON on one line as a properly quoted env value. The decoded object must include `project_id`, `client_email`, and `private_key`; its project ID must match `FIREBASE_PROJECT_ID`.

For backward compatibility, the public web-app settings and VAPID key may still use their `NEXT_PUBLIC_FIREBASE_*` names. Those Firebase client settings and the VAPID public key are not private credentials; the `NEXT_PUBLIC_` prefix does not make them secret. Never use that prefix for the service-account credential.

Restart the development server after editing `.env`. Redeploy after changing hosted environment variables.

## 3. Enable notifications in Chatie

Users enable notifications explicitly from **Preferences → Message notifications**. Tapping that control requests browser permission immediately from the click gesture, before waiting for network/configuration requests. If permission is already denied, browsers will not show another prompt; allow notifications for the site in browser settings, then try again. Users can turn notifications off from the same control.

The app registers `/firebase-messaging-sw.js` at the origin root for background notifications. Firebase Web Messaging requires a secure context: use HTTPS in deployment, or `localhost` during development. Browser/device support varies; mobile browsers may require installing the site or may not support Web Push.

After successful opt-in, the signed-in user's token is stored in Upstash Redis. New messages send a push after persistence; text shows a short preview and image, video, and PDF messages show a type label. Expired tokens are removed automatically. FCM failures do not roll back persisted messages or disable the independent Socket.IO relay.

## Troubleshooting

- **Firebase Admin credentials could not be parsed:** A multi-line unquoted `.env` value is truncated. Keep the variable name `FCM_SERVICE_ACCOUNT_JSON` and replace its value with base64 of the complete service-account JSON file, or use a single-line JSON value.
- **Credentials are missing or have the wrong project:** Check the variable names above and ensure the service account and web app use the same Firebase project. Never print credential contents to logs.
- **Permission prompt does not appear:** If site permission is already denied, re-enable it in browser settings. If already granted, no prompt is needed; Chatie should register the token. Test over HTTPS or localhost.
- **No background notification:** Confirm `/firebase-messaging-sw.js` returns status 200 on the same origin and that the app's Firebase project and VAPID key match.
