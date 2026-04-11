import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getRepoBranches } from "@upstream/common"

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const owner = searchParams.get("owner")
  const repo = searchParams.get("repo")

  if (!owner || !repo) {
    return Response.json({ error: "Missing required params: owner, repo" }, { status: 400 })
  }

  try {
    const branches = await getRepoBranches(session.accessToken, owner, repo)
    return Response.json({ branches })
  } catch (error: unknown) {
    console.error("[github/branches] Error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
