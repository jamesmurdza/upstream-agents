import { prisma } from "@/lib/prisma"
import { EXECUTION_STATUS } from "@/lib/constants"

// Cron job timeout - allow up to 60 seconds
export const maxDuration = 60

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(req: Request): boolean {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn("[cron/loop-check] CRON_SECRET not configured")
    return false
  }

  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Cron job to check for completed executions that need loop continuation.
 *
 * This is a fallback for when the client is not available (browser closed).
 * It calls the unified /api/agent/completion endpoint which handles:
 * - Auto-commit and push
 * - Loop mode continuation
 * - Branch status updates
 *
 * The completion endpoint uses a lockfile to prevent race conditions,
 * so it's safe for both client and cron to call it.
 */
export async function GET(req: Request) {
  // Verify this is a legitimate cron request
  if (!verifyCronSecret(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("[cron/loop-check] Starting loop check...")

  try {
    // Find completed executions that might need processing
    // Wait 15 seconds after completion to let client handle first
    const fifteenSecondsAgo = new Date(Date.now() - 15 * 1000)

    const executions = await prisma.agentExecution.findMany({
      where: {
        status: EXECUTION_STATUS.COMPLETED,
        completedAt: {
          lt: fifteenSecondsAgo,
        },
        message: {
          branch: {
            loopEnabled: true,
            status: "idle", // Only process if branch is idle (not already running)
          },
        },
      },
      include: {
        message: {
          include: {
            branch: true,
          },
        },
      },
      take: 10, // Process up to 10 at a time to avoid timeout
    })

    console.log(`[cron/loop-check] Found ${executions.length} completed executions to check`)

    let continued = 0
    let handled = 0

    for (const execution of executions) {
      const branch = execution.message.branch

      try {
        // Call unified completion handler
        const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
        if (!baseUrl) {
          console.error("[cron/loop-check] No NEXTAUTH_URL or VERCEL_URL configured")
          continue
        }

        const completionUrl = `${baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`}/api/agent/completion`

        const res = await fetch(completionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({
            branchId: branch.id,
            executionId: execution.id,
            status: "completed",
            content: execution.message.content,
            source: "cron",
          }),
        })

        const data = await res.json()

        if (data.handled) {
          handled++
          if (data.loopContinued) {
            continued++
            console.log(`[cron/loop-check] Loop continued for branch ${branch.id}`)
          } else {
            console.log(`[cron/loop-check] Completion handled for branch ${branch.id} (no loop continuation)`)
          }
        } else {
          console.log(`[cron/loop-check] Completion not handled for branch ${branch.id} (already processed)`)
        }
      } catch (error) {
        console.error(`[cron/loop-check] Error processing execution ${execution.id}:`, error)
      }
    }

    console.log(`[cron/loop-check] Done. Handled ${handled}, continued ${continued}`)

    return Response.json({
      success: true,
      found: executions.length,
      handled,
      continued,
    })
  } catch (error) {
    console.error("[cron/loop-check] Error:", error)
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
