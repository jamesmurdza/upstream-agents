/**
 * Agent Session utilities for Simple Chat
 * Uses shared code from @upstream/common
 */

import {
  createSession,
  getSession,
  type Event,
  type EndEvent,
} from "background-agents"
import {
  buildSystemPrompt,
  buildContentBlocks,
  agentToProvider,
  type Agent,
  type ContentBlock,
  type ToolCall,
} from "@upstream/common"
import type { Sandbox as DaytonaSandbox } from "@daytonaio/sdk"

// Re-export Agent type for convenience
export type { Agent }

// =============================================================================
// Types
// =============================================================================

export interface AgentSessionOptions {
  repoPath: string
  previewUrlPattern?: string
  sessionId?: string
  cachedEvents?: Event[]
  agent?: Agent
  model?: string
  env?: Record<string, string>
}

// =============================================================================
// Background Session
// =============================================================================

export interface BackgroundAgentSession {
  backgroundSessionId: string
  start: (prompt: string) => Promise<void>
}

export async function createBackgroundAgentSession(
  sandbox: DaytonaSandbox,
  options: AgentSessionOptions
): Promise<BackgroundAgentSession> {
  const systemPrompt = buildSystemPrompt(
    options.repoPath,
    options.previewUrlPattern
  )

  // Map agent type to SDK provider name
  const agent = options.agent || "opencode"
  const provider = agentToProvider[agent] || "opencode"

  const bgSession = await createSession(provider, {
    sandbox: sandbox as any,
    systemPrompt,
    sessionId: options.sessionId,
    cwd: options.repoPath,
    model: options.model,
    env: options.env,
  })

  return {
    backgroundSessionId: bgSession.id,
    async start(prompt: string) {
      await bgSession.start(prompt)
    },
  }
}

// =============================================================================
// Polling
// =============================================================================

export interface PollResult {
  status: "running" | "completed" | "error"
  content: string
  toolCalls: ToolCall[]
  contentBlocks: ContentBlock[]
  error?: string
  sessionId?: string
  rawEvents?: Event[]
}

export async function pollBackgroundAgent(
  sandbox: DaytonaSandbox,
  backgroundSessionId: string,
  options: AgentSessionOptions
): Promise<PollResult> {
  try {
    const systemPrompt = buildSystemPrompt(
      options.repoPath,
      options.previewUrlPattern
    )

    const bgSession = await getSession(backgroundSessionId, {
      sandbox: sandbox as any,
      systemPrompt,
    })

    const eventsResult = await bgSession.getEvents() as {
      events: Event[]
      sessionId: string | null
      cursor: string
      running?: boolean
    }

    const { events: newEvents, sessionId } = eventsResult
    let running: boolean
    if (typeof eventsResult.running === "boolean") {
      running = eventsResult.running
    } else {
      running = await bgSession.isRunning()
    }

    // Combine cached events with new events
    const cachedEvents = options.cachedEvents ?? []
    const allEvents = [...cachedEvents, ...newEvents]

    const { content, toolCalls, contentBlocks } = buildContentBlocks(allEvents)

    // Check for crash
    const crashEvent = allEvents.find(
      (e) => (e as { type: string }).type === "agent_crashed"
    ) as { type: "agent_crashed"; message?: string } | undefined
    if (crashEvent) {
      return {
        status: "error",
        content,
        toolCalls,
        contentBlocks,
        error: crashEvent.message ?? "Process exited without completing",
        sessionId: sessionId || undefined,
        rawEvents: newEvents,
      }
    }

    // Check for end event
    const endEvent = allEvents.find((e): e is EndEvent => e.type === "end") as
      | (EndEvent & { error?: string })
      | undefined

    if (endEvent?.error) {
      return {
        status: "error",
        content,
        toolCalls,
        contentBlocks,
        error: endEvent.error,
        sessionId: sessionId || undefined,
        rawEvents: newEvents,
      }
    }

    const isCompleted = !!endEvent

    if (!running && !endEvent) {
      const hasOutput = !!(content?.trim()) || toolCalls.length > 0
      return {
        status: hasOutput ? "completed" : "error",
        content,
        toolCalls,
        contentBlocks,
        error: hasOutput ? undefined : "Agent stopped without completing",
        sessionId: sessionId || undefined,
        rawEvents: newEvents,
      }
    }

    return {
      status: isCompleted ? "completed" : "running",
      content,
      toolCalls,
      contentBlocks,
      sessionId: sessionId || undefined,
      rawEvents: newEvents,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return {
      status: "error",
      content: "",
      toolCalls: [],
      contentBlocks: [],
      error: msg,
    }
  }
}
