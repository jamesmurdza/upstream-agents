import { Daytona } from "@daytonaio/sdk"
import { PATHS } from "@/lib/constants"
import { pollBackgroundAgent } from "@/lib/agent-session"

// Allow longer streaming connections (5 minutes max)
export const maxDuration = 300

// Polling interval for backend -> sandbox (ms)
const BACKEND_POLL_INTERVAL = 500

// Heartbeat interval to keep connection alive (ms)
const HEARTBEAT_INTERVAL = 15000

export async function GET(req: Request) {
  // 1. Parse query params
  const url = new URL(req.url)
  const sandboxId = url.searchParams.get("sandboxId")
  const repoName = url.searchParams.get("repoName")
  const previewUrlPattern = url.searchParams.get("previewUrlPattern")
  const backgroundSessionId = url.searchParams.get("backgroundSessionId")
  const cursorParam = url.searchParams.get("cursor")

  if (!sandboxId || !repoName || !backgroundSessionId) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: sandboxId, repoName, backgroundSessionId" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  // 2. Get Daytona API key
  const daytonaApiKey = process.env.DAYTONA_API_KEY
  if (!daytonaApiKey) {
    return new Response(
      JSON.stringify({ error: "Daytona API key not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }

  // 3. Set up SSE stream
  const encoder = new TextEncoder()
  let isStreamClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      // Track cursor for reconnection support
      let cursor = cursorParam ? parseInt(cursorParam, 10) : 0
      let heartbeatTimer: NodeJS.Timeout | null = null

      const sendEvent = (event: string, data: object) => {
        if (isStreamClosed) return
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(payload))
        } catch {
          // Stream may be closed
          isStreamClosed = true
        }
      }

      const sendHeartbeat = () => {
        sendEvent("heartbeat", { cursor, timestamp: Date.now() })
      }

      const cleanup = () => {
        isStreamClosed = true
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
      }

      try {
        // Get sandbox from Daytona
        const daytona = new Daytona({ apiKey: daytonaApiKey })
        const sandbox = await daytona.get(sandboxId)
        const repoPath = `${PATHS.SANDBOX_HOME}/${repoName}`

        // Start heartbeat timer
        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

        // Poll loop
        while (!isStreamClosed) {
          const result = await pollBackgroundAgent(sandbox, backgroundSessionId, {
            repoPath,
            previewUrlPattern: previewUrlPattern || undefined,
          })

          // Calculate new events based on cursor
          // The rawEvents from pollBackgroundAgent are the new events since last poll
          const newEvents = result.rawEvents || []
          const eventCount = newEvents.length

          if (eventCount > 0 || result.status !== "running") {
            // Send update with cursor for reconnection
            cursor += eventCount
            sendEvent("update", {
              status: result.status,
              content: result.content,
              toolCalls: result.toolCalls,
              contentBlocks: result.contentBlocks,
              cursor,
              sessionId: result.sessionId,
              error: result.error,
            })
          }

          // Check for completion
          if (result.status === "completed" || result.status === "error") {
            sendEvent("complete", {
              status: result.status,
              sessionId: result.sessionId,
              error: result.error,
              cursor,
            })
            cleanup()
            controller.close()
            return
          }

          // Wait before next poll
          await new Promise((resolve) => setTimeout(resolve, BACKEND_POLL_INTERVAL))
        }
      } catch (error) {
        console.error("[agent/stream] Error:", error)
        const message = error instanceof Error ? error.message : "Unknown error"
        sendEvent("error", { error: message, cursor })
        cleanup()
        controller.close()
      }
    },

    cancel() {
      isStreamClosed = true
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  })
}
