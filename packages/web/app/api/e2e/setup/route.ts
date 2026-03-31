/**
 * E2E test setup/teardown endpoint.
 *
 * POST: Creates a test user, mints a session JWT, creates N Daytona sandboxes,
 *       and seeds DB scaffold (Repo → Branch → Sandbox). Does NOT create
 *       messages or start agents — the test page's handleSend does that
 *       through the real /api/branches/messages and /api/agent/execute routes.
 *
 * DELETE: Cleans up Daytona sandboxes and DB records created by POST.
 *
 * No GitHub, no GITHUB_PAT, no OAuth required.
 */
import { cookies } from "next/headers"
import { encode } from "next-auth/jwt"
import { Daytona } from "@daytonaio/sdk"
import { prisma } from "@/lib/db/prisma"
import { PATHS } from "@/lib/shared/constants"

const E2E_USER_ID = "e2e-test-user"
const E2E_USER = { name: "E2E Test", email: "e2e@test.local" }

async function ensureTestUser() {
  const existing = await prisma.user.findUnique({ where: { id: E2E_USER_ID } })
  if (existing) return existing
  return prisma.user.create({
    data: { id: E2E_USER_ID, name: E2E_USER.name, email: E2E_USER.email },
  })
}

async function setSessionCookie() {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("NEXTAUTH_SECRET not set")

  const token = await encode({
    token: { sub: E2E_USER_ID, name: E2E_USER.name, email: E2E_USER.email, picture: null },
    secret,
    maxAge: 60 * 60,
  })

  const cookieStore = await cookies()
  cookieStore.set("__Secure-next-auth.session-token", token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60,
  })
  cookieStore.set("next-auth.session-token", token, {
    httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 60 * 60,
  })
}

export async function POST(req: Request) {
  const body = await req.json()
  const count: number = body.count ?? 3

  const daytonaApiKey = process.env.DAYTONA_API_KEY
  if (!daytonaApiKey) {
    return Response.json({ error: "DAYTONA_API_KEY not set" }, { status: 500 })
  }

  try {
    // 1. Create test user + auth cookie
    await ensureTestUser()
    await setSessionCookie()

    // 2. Create Daytona sandboxes concurrently
    const daytona = new Daytona({ apiKey: daytonaApiKey })
    const sandboxes = await Promise.all(
      Array.from({ length: count }, () => daytona.create())
    )

    // 3. Seed DB scaffold: Repo → Branch → Sandbox (no messages, no executions)
    const branches: Array<{
      branchId: string
      sandboxId: string
      repoName: string
    }> = []

    for (let i = 0; i < count; i++) {
      const sandbox = sandboxes[i]
      const repoName = `e2e-repo-${Date.now()}-${i}`

      // Create repo dir in sandbox so agent has a working directory
      await sandbox.process.executeCommand(`mkdir -p ${PATHS.SANDBOX_HOME}/${repoName}`)

      const repo = await prisma.repo.create({
        data: {
          userId: E2E_USER_ID,
          owner: "e2e-test",
          name: repoName,
          defaultBranch: "main",
        },
      })

      const branch = await prisma.branch.create({
        data: {
          repoId: repo.id,
          name: `e2e-branch-${i}`,
          baseBranch: "main",
          status: "idle",
          agent: "opencode",
        },
      })

      await prisma.sandbox.create({
        data: {
          sandboxId: sandbox.id,
          sandboxName: `e2e-sandbox-${i}`,
          userId: E2E_USER_ID,
          branchId: branch.id,
          status: "idle",
        },
      })

      branches.push({
        branchId: branch.id,
        sandboxId: sandbox.id,
        repoName,
      })
    }

    return Response.json({ branches })
  } catch (error) {
    console.error("[e2e/setup] Error:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

export async function DELETE(req: Request) {
  const body = await req.json().catch(() => ({}))
  const sandboxIds: string[] = body.sandboxIds || []

  const daytonaApiKey = process.env.DAYTONA_API_KEY
  if (!daytonaApiKey) {
    return Response.json({ error: "DAYTONA_API_KEY not set" }, { status: 500 })
  }

  const daytona = new Daytona({ apiKey: daytonaApiKey })

  for (const id of sandboxIds) {
    try {
      const sandbox = await daytona.get(id)
      await sandbox.delete()
    } catch { /* best effort */ }
  }

  try {
    const repos = await prisma.repo.findMany({
      where: { userId: E2E_USER_ID },
      select: { id: true },
    })
    const repoIds = repos.map(r => r.id)

    if (repoIds.length > 0) {
      const branchIds = (await prisma.branch.findMany({
        where: { repoId: { in: repoIds } },
        select: { id: true },
      })).map(b => b.id)

      if (branchIds.length > 0) {
        const messageIds = (await prisma.message.findMany({
          where: { branchId: { in: branchIds } },
          select: { id: true },
        })).map(m => m.id)

        if (messageIds.length > 0) {
          await prisma.agentExecution.deleteMany({ where: { messageId: { in: messageIds } } })
          await prisma.message.deleteMany({ where: { id: { in: messageIds } } })
        }
        await prisma.sandbox.deleteMany({ where: { branchId: { in: branchIds } } })
        await prisma.branch.deleteMany({ where: { id: { in: branchIds } } })
      }
      await prisma.repo.deleteMany({ where: { id: { in: repoIds } } })
    }
  } catch (err) {
    console.error("[e2e/setup] Cleanup error:", err)
  }

  return Response.json({ ok: true })
}
