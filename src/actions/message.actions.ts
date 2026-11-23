"use server"

import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server"
import { v2 as cloudinary } from "cloudinary"
import { redis } from "@/lib/db"
import { sendNewMessagePush } from "@/lib/firebase-admin"
import { Message, MessageType } from "@/types/message"

interface SendMessageArgs {
  content: string
  messageType: MessageType
  receiverId: string
}

type CloudinaryResourceType = 'image' | 'video' | 'raw'

export async function sendMessageAction({ content, messageType, receiverId }: SendMessageArgs) {
  const { getUser } = getKindeServerSession()
  const user = await getUser()
  if (!user) return { success: false as const, message: "User not authenticated" }
  if (!content || !receiverId) return { success: false as const, message: "Message content and recipient are required" }

  const senderId = user.id
  const conversationId = `conversation:${[senderId, receiverId].sort().join(":")}`
  const messageId = `message:${Date.now()}:${Math.random().toString(36).substring(2, 9)}`
  const timeStamp = Date.now()
  const pipeline = redis.pipeline()

  pipeline.hset(conversationId, { participant1: senderId, participant2: receiverId })
  pipeline.sadd(`user:${senderId}:conversations`, conversationId)
  pipeline.sadd(`user:${receiverId}:conversations`, conversationId)
  pipeline.hset(messageId, { senderId, timeStamp, content, messageType })
  pipeline.zadd(`${conversationId}:messages`, { score: timeStamp, member: messageId })
  await pipeline.exec()

  if (senderId !== receiverId) {
    const senderName = [user.given_name, user.family_name].filter(Boolean).join(" ") || user.email || "Chatie user"
    let pushTimeout: ReturnType<typeof setTimeout> | undefined
    try {
      const pushResult = await Promise.race([
        sendNewMessagePush({ receiverId, senderId, senderName, messageType, content, conversationId }),
        new Promise<undefined>((resolve) => {
          pushTimeout = setTimeout(() => resolve(undefined), 2500)
        }),
      ])
      if (pushResult === undefined) console.warn("FCM push delivery exceeded the 2.5-second wait; continuing message send")
    } catch (error) {
      console.error("Push notification skipped after message persistence:", error instanceof Error ? error.message : "unknown error")
    } finally {
      if (pushTimeout) clearTimeout(pushTimeout)
    }
  }

  const room = [senderId, receiverId].sort().join('__')
  const socketServerUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL
  let broadcasted = false

  if (!socketServerUrl) {
    console.error("Socket broadcast skipped: NEXT_PUBLIC_SOCKET_SERVER_URL is not configured")
  } else {
    try {
      const response = await fetch(`${socketServerUrl.replace(/\/+$/, '')}/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room,
          event: "newMessage",
          data: { message: { id: messageId, senderId, content, timeStamp, messageType } }
        }),
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      })
      broadcasted = response.ok
      if (!response.ok) console.error(`Socket broadcast rejected with status ${response.status}`)
    } catch (error) {
      console.error("Socket broadcast request failed:", error instanceof Error ? error.message : 'unknown error')
    }
  }

  // Persistence remains successful if the live relay is temporarily unavailable;
  // clients reconcile missed messages on reconnect and after the sender mutation.
  return { success: true as const, conversationId, messageId, broadcasted }
}

export async function deleteUploadedMediaAction({
  publicId,
  resourceType,
}: {
  publicId: string
  resourceType: CloudinaryResourceType
}) {
  const { getUser } = getKindeServerSession()
  const user = await getUser()
  if (!user) return { success: false as const, message: "User not authenticated" }

  // Uploads are scoped to a user-owned folder; never accept path traversal or arbitrary IDs.
  const expectedFolder = `chat/${user.id}`
  const segments = publicId.split('/')
  if (!publicId || segments.some((segment) => segment === '.' || segment === '..') || !['image', 'video', 'raw'].includes(resourceType)) {
    return { success: false as const, message: "Upload is not owned by this user" }
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    return { success: false as const, message: "Cloudinary is not configured" }
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })
  try {
    const publicIdIsInUserFolder = segments.slice(0, 2).join('/') === expectedFolder
    if (!publicIdIsInUserFolder) {
      const asset = await cloudinary.api.resource(publicId, { resource_type: resourceType, type: 'upload' })
      const assetFolders = [asset.asset_folder, asset.folder].filter((folder): folder is string => typeof folder === 'string')
      const assetBelongsToUser = assetFolders.some((folder) => folder === expectedFolder || folder.startsWith(`${expectedFolder}/`))
      if (!assetBelongsToUser) return { success: false as const, message: "Upload is not owned by this user" }
    }
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: 'upload',
      invalidate: true,
    })
    return { success: result.result === 'ok' || result.result === 'not found' }
  } catch (error) {
    console.error("Cloudinary upload cleanup failed:", error instanceof Error ? error.message : 'unknown error')
    return { success: false as const, message: "Could not remove the cancelled upload" }
  }
}

export async function getMessageAction(selectedUserId: string, currentUserId: string) {
  const conversationId = `conversation:${[selectedUserId, currentUserId].sort().join(":")}`
  const messageIds = await redis.zrange(`${conversationId}:messages`, 0, -1)
  if (messageIds.length === 0) return []

  const pipeline = redis.pipeline()
  messageIds.forEach((messageId) => pipeline.hgetall(messageId as string))
  const messages = await pipeline.exec() as Array<Omit<Message, 'id'> | null>
  return messages.flatMap((message, index) =>
    message && message.content ? [{ ...message, id: String(messageIds[index]) }] : []
  )
}
