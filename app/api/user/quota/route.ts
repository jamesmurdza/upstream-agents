import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getQuota } from "@/lib/quota"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const quota = await getQuota(session.user.id)
  return Response.json(quota)
}
