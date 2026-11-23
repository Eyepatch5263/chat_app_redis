"use server"

import { createHash } from "node:crypto"
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server"
import { redis } from "@/lib/db"
import { expectedFirebaseProjectId, readFirebaseServiceAccount } from "@/lib/firebase-service-account"

function tokenOwnerKey(token: string) {
  const digest = createHash("sha256").update(token).digest("hex")
  return `fcm-token-owner:${digest}`
}

function isValidToken(token: unknown): token is string {
  return typeof token === "string" && token.length >= 20 && token.length <= 4096
}

export async function registerPushTokenAction(token: string) {
  const { getUser } = getKindeServerSession()
  const user = await getUser()
  if (!user) return { success: false as const, message: "You must be signed in to enable notifications." }
  if (!isValidToken(token)) return { success: false as const, message: "The notification registration token is invalid." }

  const adminConfig = readFirebaseServiceAccount()
  if (!adminConfig.ok) {
    const message = adminConfig.reason === "missing"
      ? "Firebase Admin credentials are not configured. Set FCM_SERVICE_ACCOUNT_JSON to the complete service-account JSON or its base64-encoded contents."
      : adminConfig.reason === "invalid-json"
        ? "Firebase Admin credentials could not be parsed. Set FCM_SERVICE_ACCOUNT_JSON to complete JSON or base64-encoded JSON; unquoted multiline JSON in .env is truncated."
        : "Firebase Admin credentials are missing required project_id, client_email, or private_key fields."
    return { success: false as const, message }
  }

  const expectedProjectId = expectedFirebaseProjectId()
  if (expectedProjectId && adminConfig.serviceAccount.project_id !== expectedProjectId) {
    return { success: false as const, message: "Firebase Admin credentials belong to a different Firebase project than the web app configuration." }
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
