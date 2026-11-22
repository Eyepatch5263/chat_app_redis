"use server"

import { redis } from "@/lib/db"
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server"

export async function checkAuthStatus() {
    const { getUser } = getKindeServerSession()
    const user = await getUser()

    if (!user) {
        return { success: false }
    }
    const userId = `user:${user.id}`
    const existingUser = await redis.hgetall(userId)
    //sign up case 
    if (!existingUser || Object.keys(existingUser).length === 0) {
        const imgIsNull = !user.picture || user.picture.includes("gravatar")
        const image = imgIsNull
            ? `https://avatar.iran.liara.run/public/boy?username=${encodeURIComponent(user?.given_name || user.id)}`
            : user.picture
        const name = `${user.given_name || ""} ${user.family_name ?? ""}`.trim() || user.email || "User"
        await redis.hset(userId, {
            id: user.id,
            name: name,
            email: user.email || "",
            image: image
        })
    }

    return { success: true }
}