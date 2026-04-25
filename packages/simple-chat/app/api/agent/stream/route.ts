import { Daytona } from "@daytonaio/sdk"
import { Prisma } from "@prisma/client"
import { PATHS } from "@/lib/constants"
import {
  finalizeTurn,
  snapshotBackgroundAgent,
  type AgentSnapshot,
} from "@/lib/agent-session"
import { prisma } from "@/lib/db/prisma"
import { getAuthUserId, getChatWithAuth } from "@/lib/db/api-helpers"

// Allow longer streaming connections (5 minutes max)
export const maxDuration = 300

// Polling interval for backend -> sandbox (ms)
const BACKEND_POLL_INTERVAL = 500

// Heartbeat interval to keep connection alive (ms)
const HEARTBEAT_INTERVAL = 15000

// How often to persist to database (ms)
const DB_PERSIST_INTERVAL = 5000

export async function GET(req: Request) {
  // 1. Parse query params
  const url = new URL(req.url)
  const sandboxId = url.searchParams.get("sandboxId")
  const repoName = url.searchParams.get("repoName")
  const previewUrlPattern = url.searchParams.get("previewUrlPattern")
  const backgroundSessionId = url.searchParams.get("backgroundSessionId")
  const cursorParam = url.searchParams.get("cursor")
  const chatId = url.searchParams.get("chatId")
  const assistantMessageId = url.searchParams.get("assistantMessageId")

  if (!sandboxId || !repoName || !backgroundSessionId) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: sandboxId, repoName, backgroundSessionId" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  // 2. Auth: require login, and if a chatId/assistantMessageId is provided
  // verify the caller owns the chat and the message lives in it.
  const userId = await getAuthUserId()
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    )
  }
  if (chatId) {
    const chat = await getChatWithAuth(chatId, userId)
    if (!chat) {
      return new Response(
        JSON.stringify({ error: "Chat not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      )
    }
    if (assistantMessageId) {
      const msg = await prisma.message.findFirst({
        where: { id: assistantMessageId, chatId },
        select: { id: true },
      })
      if (!msg) {
        return new Response(
          JSON.stringify({ error: "Message not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        )
      }
    }
  }

  // 3. Get Daytona API key
  const daytonaApiKey = process.env.DAYTONA_API_KEY
  if (!daytonaApiKey) {
    return new Response(
      JSON.stringify({ error: "Daytona API key not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }

  // 4. Set up SSE stream
  const encoder = new TextEncoder()
  let isStreamClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      // SSE poll-counter, used by the client for reconnection bookkeeping.
      let cursor = cursorParam ? parseInt(cursorParam, 10) : 0
      let heartbeatTimer: NodeJS.Timeout | null = null
      let lastDbPersist = Date.now()
      // Signature of the last "update" we sent on the wire — used to skip
      // sending no-op updates when the agent hasn't produced anything new.
      let lastSentSig: string | null = null

      const sendEvent = (event: string, data: object) => {
        if (isStreamClosed) return
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(payload))
        } catch {
          isStreamClosed = true
        }
      }

      const sendHeartbeat = () => {
        sendEvent("heartbeat", { cursor, timestamp: Date.now() })
      }

      // Persist a snapshot to the DB. The snapshot is the source of truth —
      // the route never holds a separate accumulator that could drift.
      const persistSnapshot = async (
        snap: AgentSnapshot,
        isFinal: boolean
      ) => {
        if (!chatId || !assistantMessageId) return
        // Don't write empty rows for non-final flushes (the assistant
        // placeholder created in /api/agent/start is already content="").
        const hasContent =
          !!snap.content || snap.toolCalls.length > 0 || snap.contentBlocks.length > 0
        if (!hasContent && !isFinal) return

        try {
          await prisma.message.update({
            where: { id: assistantMessageId },
            data: {
              content: snap.content,
              toolCalls:
                snap.toolCalls.length > 0
                  ? (snap.toolCalls as unknown as Prisma.InputJsonValue)
                  : undefined,
              contentBlocks:
                snap.contentBlocks.length > 0
                  ? (snap.contentBlocks as unknown as Prisma.InputJsonValue)
                  : undefined,
            },
          })

          const chatUpdate: Record<string, unknown> = {
            lastActiveAt: new Date(),
          }
          if (isFinal) {
            chatUpdate.status = snap.status === "error" ? "error" : "ready"
            chatUpdate.backgroundSessionId = null
            if (snap.sessionId) chatUpdate.sessionId = snap.sessionId
          }
          await prisma.chat.update({
            where: { id: chatId },
            data: chatUpdate,
          })

          lastDbPersist = Date.now()
        } catch (error) {
          console.error("[agent/stream] DB persist error:", error)
        }
      }

      const sendUpdateIfChanged = (snap: AgentSnapshot) => {
        const sig = `${snap.status}|${snap.content.length}|${snap.toolCalls.length}|${snap.contentBlocks.length}|${snap.error ?? ""}`
        if (sig === lastSentSig) return
        lastSentSig = sig
        cursor += 1
        sendEvent("update", {
          status: snap.status,
          content: snap.content,
          toolCalls: snap.toolCalls,
          contentBlocks: snap.contentBlocks,
          cursor,
          sessionId: snap.sessionId,
          error: snap.error,
        })
      }

      const cleanup = (closeController: boolean = false) => {
        if (isStreamClosed && !closeController) return
        isStreamClosed = true
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
        if (closeController) {
          try {
            controller.close()
          } catch {
            /* already closed */
          }
        }
      }

      try {
        const daytona = new Daytona({ apiKey: daytonaApiKey })
        const sandbox = await daytona.get(sandboxId)
        const repoPath = `${PATHS.SANDBOX_HOME}/${repoName}`
        const sessionOpts = {
          repoPath,
          previewUrlPattern: previewUrlPattern || undefined,
        }

        heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL)

        // The polling loop. Each iteration: take a cumulative snapshot of
        // the agent's event log (source of truth = the file in the sandbox),
        // send it to the client, and periodically persist it to the DB. The
        // route holds NO accumulator state of its own — the snapshot is
        // re-derived from the file each time, so a new SSE connection
        // (reconnect) automatically reconstructs the full state.
        while (!isStreamClosed) {
          const snap = await snapshotBackgroundAgent(
            sandbox,
            backgroundSessionId,
            sessionOpts
          )

          sendUpdateIfChanged(snap)

          if (snap.status === "completed" || snap.status === "error") {
            // Final DB flush from the same snapshot we just sent.
            await persistSnapshot(snap, true)

            // Advance the bg session's per-turn meta so the next start()
            // writes to a fresh outputFile.
            await finalizeTurn(sandbox, backgroundSessionId, sessionOpts)

            sendEvent("complete", {
              status: snap.status,
              sessionId: snap.sessionId,
              error: snap.error,
              cursor,
            })
            cleanup(true)
            return
          }

          // Periodic DB flush — same snapshot, no extra roundtrip.
          if (Date.now() - lastDbPersist >= DB_PERSIST_INTERVAL) {
            await persistSnapshot(snap, false)
          }

          if (isStreamClosed) break

          await new Promise((resolve) =>
            setTimeout(resolve, BACKEND_POLL_INTERVAL)
          )
        }

        // Client disconnected mid-stream. Take one more snapshot (the agent
        // may have produced output between our last poll and the
        // disconnect) and flush. Leave chat.status as "running" — the
        // agent in the sandbox is still alive and a reconnect will resume.
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer)
          heartbeatTimer = null
        }
        try {
          const finalSnap = await snapshotBackgroundAgent(
            sandbox,
            backgroundSessionId,
            sessionOpts
          )
          await persistSnapshot(finalSnap, false)
        } catch (error) {
          console.error("[agent/stream] disconnect-flush error:", error)
        }
      } catch (error) {
        console.error("[agent/stream] Error:", error)
        const message = error instanceof Error ? error.message : "Unknown error"

        if (chatId) {
          try {
            await prisma.chat.update({
              where: { id: chatId },
              data: {
                status: "error",
                backgroundSessionId: null,
              },
            })
          } catch {
            /* best effort */
          }
        }

        sendEvent("error", { error: message, cursor })
        cleanup(true)
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
      "X-Accel-Buffering": "no",
    },
  })
}
