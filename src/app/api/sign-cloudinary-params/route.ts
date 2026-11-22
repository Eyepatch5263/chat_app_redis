import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server"
import { v2 as cloudinary } from "cloudinary"

export async function POST(request: Request) {
  const { getUser } = getKindeServerSession()
  const user = await getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const paramsToSign = body?.paramsToSign
  const requestedFolder = paramsToSign?.folder || paramsToSign?.asset_folder
  if (!paramsToSign || requestedFolder !== `chat/${user.id}`) {
    return Response.json({ error: "Invalid upload folder" }, { status: 400 })
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) {
    return Response.json({ error: "Cloudinary is not configured" }, { status: 500 })
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })
  const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret)
  return Response.json({ signature })
}
