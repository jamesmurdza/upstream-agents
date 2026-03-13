import { prisma } from "@/lib/prisma"
import { Daytona } from "@daytonaio/sdk"
import { requireAuth, isAuthError, internalError, getDaytonaApiKey, isDaytonaKeyError } from "@/lib/api-helpers"
import { checkBackgroundAgentStatus } from "@/lib/agent-session"
import { PATHS } from "@/lib/constants"

// Lightweight sync endpoint for cross-device state synchronization
// Returns all repos with branch statuses, last message info, etc.
// Also checks for completed background agents and updates their status
export async function GET() {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  try {
    // Get all repos for user with branch info
    const repos = await prisma.repo.findMany({
      where: {
        userId: auth.userId,
      },
      select: {
        id: true,
        name: true,
        owner: true,
        avatar: true,
        defaultBranch: true,
        branches: {
          select: {
            id: true,
            name: true,
            status: true,
            baseBranch: true,
            prUrl: true,
            unread: true,
            sandbox: {
              select: {
                sandboxId: true,
                status: true,
              },
            },
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: {
                id: true,
                createdAt: true,
              },
            },
          },
        },
      },
    })

    // Find branches with status "running" and check if their agent has completed
    // This allows the sync to detect completion even when no client is polling
    const runningBranches = repos.flatMap((r) =>
      r.branches.filter((b) => b.status === "running" && b.sandbox?.sandboxId)
    )

    if (runningBranches.length > 0) {
      const daytonaApiKey = getDaytonaApiKey()
      if (!isDaytonaKeyError(daytonaApiKey)) {
        const daytona = new Daytona({ apiKey: daytonaApiKey })

        // Check each running branch's actual status (in parallel, with timeout)
        const statusChecks = runningBranches.map(async (branch) => {
          try {
            const sandboxId = branch.sandbox!.sandboxId
            const sandbox = await daytona.get(sandboxId)

            // Get the active execution for this branch
            const execution = await prisma.agentExecution.findFirst({
              where: {
                status: "running",
                message: { branchId: branch.id },
              },
              orderBy: { startedAt: "desc" },
              include: {
                message: {
                  include: {
                    branch: {
                      include: {
                        repo: true,
                        sandbox: true,
                      },
                    },
                  },
                },
              },
            })

            if (!execution) return null

            // Check agent status without full polling (just check if done)
            const repoName = execution.message.branch.repo?.name || "repo"
            const repoPath = `${PATHS.SANDBOX_HOME}/${repoName}`
            const sessionId = execution.message.branch.sandbox?.sessionId || execution.executionId
            const agent = (execution.message.branch.agent || "claude-code") as import("@/lib/types").Agent
            const model = execution.message.branch.model || undefined

            const result = await checkBackgroundAgentStatus(sandbox, sessionId, {
              repoPath,
              agent,
              model,
            })

            if (result.completed) {
              // Agent completed! Update database status and mark as unread
              await prisma.$transaction([
                prisma.agentExecution.update({
                  where: { id: execution.id },
                  data: { status: "completed", completedAt: new Date() },
                }),
                prisma.branch.update({
                  where: { id: branch.id },
                  data: { status: "idle", unread: true },
                }),
                prisma.sandbox.update({
                  where: { id: execution.message.branch.sandbox!.id },
                  data: { status: "idle" },
                }),
              ])

              return { branchId: branch.id, newStatus: "idle", unread: true }
            }

            return null
          } catch (err) {
            // Ignore errors for individual branch checks
            console.warn(`[sync] Failed to check branch ${branch.id}:`, err)
            return null
          }
        })

        // Wait for all checks with a timeout
        const results = await Promise.race([
          Promise.all(statusChecks),
          new Promise<null[]>((resolve) => setTimeout(() => resolve([]), 3000)), // 3s timeout
        ])

        // Update local repo data with any status changes
        for (const result of results) {
          if (result && result.newStatus) {
            const repo = repos.find((r) => r.branches.some((b) => b.id === result.branchId))
            const branch = repo?.branches.find((b) => b.id === result.branchId)
            if (branch) {
              ;(branch as { status: string }).status = result.newStatus
              ;(branch as { unread: boolean }).unread = result.unread
            }
          }
        }
      }
    }

    // Return compact sync data
    const syncData = {
      timestamp: Date.now(),
      repos: repos.map((r) => ({
        id: r.id,
        name: r.name,
        owner: r.owner,
        avatar: r.avatar,
        defaultBranch: r.defaultBranch,
        branches: r.branches.map((b) => ({
          id: b.id,
          name: b.name,
          status: b.status,
          baseBranch: b.baseBranch,
          prUrl: b.prUrl,
          unread: b.unread,
          sandboxId: b.sandbox?.sandboxId || null,
          sandboxStatus: b.sandbox?.status || null,
          lastMessageId: b.messages[0]?.id || null,
          lastMessageAt: b.messages[0]?.createdAt?.getTime() || null,
        })),
      })),
    }

    return Response.json(syncData)
  } catch (error) {
    console.error("Sync error:", error)
    return internalError(error)
  }
}
