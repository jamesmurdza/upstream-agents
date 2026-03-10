import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { owner, repo, head, base } = body

  if (!owner || !repo || !head || !base) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "github" },
  })
  const token = account?.access_token

  if (!token) {
    return Response.json({ error: "GitHub token not found" }, { status: 401 })
  }

  try {
    // Get commits between base and head for PR body
    const compareRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    )

    let prBody = ""
    if (compareRes.ok) {
      const compareData = await compareRes.json()
      const commits = (compareData.commits || []) as { commit: { message: string } }[]
      if (commits.length > 0) {
        prBody = commits
          .map((c: { commit: { message: string } }) => `- ${c.commit.message}`)
          .join("\n")
      }
    }

    // Generate title from branch name
    const title = head
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c: string) => c.toUpperCase())

    // Create the PR
    const prRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
          title,
          body: prBody || "Automated PR",
          head,
          base,
        }),
      }
    )

    const prData = await prRes.json()
    if (!prRes.ok) {
      const message = (prData as { message?: string }).message || `PR creation failed (${prRes.status})`
      return Response.json({ error: message }, { status: prRes.status })
    }

    // Update branch with PR URL
    const branchRecord = await prisma.branch.findFirst({
      where: {
        name: head,
        repo: {
          owner,
          name: repo,
          userId: session.user.id,
        },
      },
    })
    if (branchRecord) {
      await prisma.branch.update({
        where: { id: branchRecord.id },
        data: { prUrl: prData.html_url },
      })
    }

    return Response.json({
      url: prData.html_url,
      number: prData.number,
      title: prData.title,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
