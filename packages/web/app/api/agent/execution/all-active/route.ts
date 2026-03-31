import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth/auth"
import { prisma } from "@/lib/db/prisma"

/**
 * Get ALL active (running) executions for the current user.
 * Used to resume polling after page refresh for all branches at once.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Find all running executions for branches owned by this user
  const executions = await prisma.agentExecution.findMany({
    where: {
      status: "running",
      message: {
        branch: {
          repo: {
            userId: session.user.id,
          },
        },
      },
    },
    orderBy: {
      startedAt: "desc",
    },
    include: {
      message: {
        include: {
          branch: {
            include: {
              repo: true,
            },
          },
        },
      },
    },
  })

  return Response.json({
    executions: executions.map((exec) => ({
      executionId: exec.executionId,
      messageId: exec.messageId,
      status: exec.status,
      sandboxId: exec.sandboxId || exec.message.branch.sandboxId,
      branchId: exec.message.branchId,
      branchName: exec.message.branch.name,
      repoId: exec.message.branch.repo.id,
      repoName: exec.message.branch.repo.name,
      repoOwner: exec.message.branch.repo.owner,
      loopEnabled: exec.message.branch.loopEnabled,
      loopCount: exec.message.branch.loopCount,
      loopMaxIterations: exec.message.branch.loopMaxIterations,
      lastShownCommitHash: exec.message.branch.lastShownCommitHash,
    })),
  })
}
