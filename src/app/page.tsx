import ChatLayout from "@/components/Chat/ChatLayout";
import { redis } from "@/lib/db";
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { redirect } from 'next/navigation'
import { User } from "@/types/user";
import { checkAuthStatus } from "@/actions/auth.actions";

async function getUsers(): Promise<User[]> {
  const userKeys: string[] = []
  let cursor = "0"
  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: "user:*", type: "hash", count: 100 })
    cursor = nextCursor
    userKeys.push(...keys)

  } while (cursor !== "0")

  const { getUser } = getKindeServerSession()
  const currentUser = await getUser()

  const pipeline = redis.pipeline()
  if (pipeline && userKeys.length > 0) {
    userKeys.forEach(key => pipeline.hgetall(key))
    const result = (await pipeline.exec()) as User[]
    const users: User[] = []
    for (const user of result) {
      if (user.id !== currentUser?.id)
        users.push(user)
    }
    return users
  }
  return []
}
export default async function Home() {
  const { isAuthenticated } = getKindeServerSession()
  if (!(await isAuthenticated())) {
    return redirect('/auth')
  }
  await checkAuthStatus()
  const users = await getUsers()
  // const layout = cookies().get("resizable-panel-layout")
  const defaultLayout = undefined
  return (
    <main className="app-frame">
      <ChatLayout users={users} defaultLayout={defaultLayout} />
    </main>
  );
}
