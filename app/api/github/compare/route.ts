import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "github" },
  })
  const token = account?.access_token

  if (!token) {
    return Response.json({ error: "GitHub account not linked" }, { status: 401 })
  }

  const body = await req.json()
  const { owner, repo, base, head, commitHash } = body

  if (!owner || !repo) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github.v3.diff",
  }

  try {
    let url: string
    if (commitHash) {
      // Single commit diff
      url = `https://api.github.com/repos/${owner}/${repo}/commits/${commitHash}`
    } else if (base && head) {
      // Branch comparison
      url = `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`
    } else {
      return Response.json({ error: "Must provide commitHash or base+head" }, { status: 400 })
    }

    const res = await fetch(url, { headers })
    if (!res.ok) {
      const text = await res.text()
      return Response.json({ error: `GitHub API error: ${res.status} ${text}` }, { status: res.status })
    }

    const diff = await res.text()
    return Response.json({ diff })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
