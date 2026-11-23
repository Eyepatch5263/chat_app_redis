import "server-only"

import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getMessaging, type MulticastMessage } from "firebase-admin/messaging"
import { redis } from "@/lib/db"
import type { MessageType } from "@/types/message"

const ADMIN_APP_NAME = "chatie-fcm-admin"
const MAX_TOKENS_PER_SEND = 500

interface NewMessagePush {
  receiverId: string
  senderId: string
  senderName: string
  messageType: MessageType
  content: string
  conversationId: string
}

function getAdminMessaging() {
  const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON
  if (!serviceAccountJson) return null

  try {
    const serviceAccount = JSON.parse(serviceAccountJson) as {
      project_id?: string
      client_email?: string
      private_key?: string
    }
    const expectedProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      console.error("FCM service account is missing required fields")
      return null
    }
    if (expectedProjectId && expectedProjectId !== serviceAccount.project_id) {
      console.error("FCM service account project does not match the Firebase web project")
      return null
    }

    const app = getApps().find((candidate) => candidate.name === ADMIN_APP_NAME) ??
      initializeApp({
        credential: cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key.replace(/\\n/g, "\n"),
        }),
      }, ADMIN_APP_NAME)

    return getMessaging(app)
  } catch (error) {
    console.error("FCM server configuration could not be initialized:", error instanceof Error ? error.message : "unknown error")
    return null
  }
}

function getNotificationBody(messageType: MessageType, content: string) {
  if (messageType === "image") return "Sent a photo"
  if (messageType === "video") return "Sent a video"
  if (messageType === "pdf") return "Sent a document"
  const plainText = content.replace(/\s+/g, " ").trim()
  return plainText.length > 140 ? `${plainText.slice(0, 137)}…` : plainText
}

async function removeExpiredToken(userId: string, token: string) {
  const ownerDigest = await import("node:crypto").then(({ createHash }) =>
    createHash("sha256").update(token).digest("hex")
  )
  const ownerKey = `fcm-token-owner:${ownerDigest}`
  const owner = await redis.get<string>(ownerKey)
  if (owner === userId) {
    await redis.srem(`user:${userId}:fcm-tokens`, token)
    await redis.del(ownerKey)
  }
}

export async function sendNewMessagePush(input: NewMessagePush) {
  const messaging = getAdminMessaging()
  if (!messaging) return { attempted: false, sent: 0 }

  try {
    const storedTokens = await redis.smembers(`user:${input.receiverId}:fcm-tokens`)
    const tokens = storedTokens.filter((token): token is string => typeof token === "string" && token.length > 0)
    if (tokens.length === 0) return { attempted: false, sent: 0 }

    const body = getNotificationBody(input.messageType, input.content)
    let sent = 0
    for (let offset = 0; offset < tokens.length; offset += MAX_TOKENS_PER_SEND) {
      const batchTokens = tokens.slice(offset, offset + MAX_TOKENS_PER_SEND)
      const message: MulticastMessage = {
        tokens: batchTokens,
        data: {
          title: `New message from ${input.senderName || "Chatie user"}`,
          body: body || "You have a new message",
          senderId: input.senderId,
          senderName: input.senderName || "Chatie user",
          messageType: input.messageType,
          conversationId: input.conversationId,
          link: "/",
        },
        webpush: {
          headers: { TTL: "86400" },
        },
      }

      const result = await messaging.sendEachForMulticast(message)
      sent += result.successCount
      const expiredTokens: string[] = []
      result.responses.forEach((response, index) => {
        const code = response.error?.code
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
          expiredTokens.push(batchTokens[index])
        } else if (!response.success && code) {
          console.warn("FCM push delivery failed:", code)
        }
      })
      await Promise.all(expiredTokens.map((token) => removeExpiredToken(input.receiverId, token)))
    }

    return { attempted: true, sent }
  } catch (error) {
    console.error("FCM push delivery failed:", error instanceof Error ? error.message : "unknown error")
    return { attempted: true, sent: 0 }
  }
}
