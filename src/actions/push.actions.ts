"use server"

import { createHash } from "node:crypto"
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server"
import { redis } from "@/lib/db"

function tokenOwnerKey(token: string) {
  const digest = createHash("sha256").update(token).digest("hex")
  return `fcm-token-owner:${digest}`
}

function isValidToken(token: unknown): token is string {
  return typeof token === "string" && token.length >= 20 && token.length <= 4096
}

function hasValidAdminConfiguration() {
  const config = process.env.FCM_SERVICE_ACCOUNT_JSON
  if (!config) return false
  try {
    const serviceAccount = JSON.parse(config) as {
      project_id?: string
      client_email?: string
      private_key?: string
    }
    const expectedProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    return Boolean(
      serviceAccount.project_id &&
      serviceAccount.client_email &&
      serviceAccount.private_key?.includes("-----BEGIN PRIVATE KEY-----") &&
      (!expectedProjectId || serviceAccount.project_id === expectedProjectId)
    )
  } catch {
    return false
  }
}

export async function registerPushTokenAction(token: string) {
  const { getUser } = getKindeServerSession()
  const user = await getUser()
  if (!user) return { success: false as const, message: "You must be signed in to enable notifications." }
  if (!isValidToken(token)) return { success: false as const, message: "The notification registration token is invalid." }
  if (!hasValidAdminConfiguration()) {
    return { success: false as const, message: "Firebase Admin credentials are missing, invalid, or use a different Firebase project." }
  }

  const ownerKey = tokenOwnerKey(token)
  const previousOwner = await redis.get<string>(ownerKey)
  if (previousOwner && previousOwner !== user.id) {
    await redis.srem(`user:${previousOwner}:fcm-tokens`, token)
  }

  await redis.sadd(`user:${user.id}:fcm-tokens`, token)
  await redis.set(ownerKey, user.id)
  return { success: true as const }
}

export async function unregisterPushTokenAction(token: string) {
  const { getUser } = getKindeServerSession()
  const user = await getUser()
  if (!user || !isValidToken(token)) return { success: false as const }

  const ownerKey = tokenOwnerKey(token)
  const owner = await redis.get<string>(ownerKey)
  if (owner === user.id) {
    await redis.srem(`user:${user.id}:fcm-tokens`, token)
    await redis.del(ownerKey)
  }

  return { success: true as const }
}
