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
  const { owner, name } = body

  if (!owner || !name) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${name}/forks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      const message = (data as { message?: string }).message || `Fork failed (${res.status})`
      return Response.json({ error: message }, { status: res.status })
    }

    const data = await res.json()
    return Response.json({
      name: data.name,
      owner: data.owner.login,
      avatar: data.owner.avatar_url,
      defaultBranch: data.default_branch,
      fullName: data.full_name,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
