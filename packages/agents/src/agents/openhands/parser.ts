/**
 * OpenHands CLI output parser
 *
 * Pure function for parsing OpenHands CLI JSON output.
 * The OpenHands CLI with --json flag outputs JSONL events with
 * "type": "action" or "type": "observation" fields.
 */

import type { Event } from "../../types/events.js"
import type { ParseContext } from "../../core/agent.js"
import { createToolStartEvent, normalizeToolName } from "../../core/tools.js"
import { safeJsonParse } from "../../utils/json.js"

/**
 * Raw event types from OpenHands' JSON stream
 */
interface OpenHandsActionEvent {
  type: "action"
  action: string
  args?: {
    command?: string
    path?: string
    file_path?: string
    content?: string
    thought?: string
    [key: string]: unknown
  }
  message?: string
  id?: number
  timestamp?: string
}

interface OpenHandsObservationEvent {
  type: "observation"
  observation?: string
  content?: string
  extras?: {
    exit_code?: number
    command?: string
    [key: string]: unknown
  }
  id?: number
  timestamp?: string
}

interface OpenHandsMessageEvent {
  type: "message"
  role?: "user" | "assistant" | "system"
  content?: string
  message?: string
}

interface OpenHandsStatusEvent {
  type: "status"
  status?: string
  message?: string
  conversation_id?: string
  session_id?: string
}

interface OpenHandsErrorEvent {
  type: "error"
  message?: string
  error?: string
}

interface OpenHandsFinishEvent {
  type: "finish"
  state?: string
  message?: string
}

type OpenHandsEvent =
  | OpenHandsActionEvent
  | OpenHandsObservationEvent
  | OpenHandsMessageEvent
  | OpenHandsStatusEvent
  | OpenHandsErrorEvent
  | OpenHandsFinishEvent

/**
 * Parse a line of OpenHands CLI output into event(s).
 *
 * Uses context.sessionId to track if session event was already emitted.
 */
export function parseOpenhandsLine(
  line: string,
  toolMappings: Record<string, string>,
  context: ParseContext
): Event | null {
  const json = safeJsonParse<OpenHandsEvent>(line)
  if (!json) {
    return null
  }

  // Status event - may contain session/conversation ID
  if (json.type === "status") {
    const statusEvent = json as OpenHandsStatusEvent
    const sessionId = statusEvent.session_id || statusEvent.conversation_id
    if (sessionId && context.sessionId !== sessionId) {
      context.sessionId = sessionId
      return { type: "session", id: sessionId }
    }
    return null
  }

  // Message event - assistant text output
  if (json.type === "message") {
    const messageEvent = json as OpenHandsMessageEvent
    if (messageEvent.role === "assistant" && (messageEvent.content || messageEvent.message)) {
      return { type: "token", text: messageEvent.content || messageEvent.message || "" }
    }
    return null
  }

  // Action event - tool invocation
  if (json.type === "action") {
    const actionEvent = json as OpenHandsActionEvent
    const actionName = actionEvent.action?.toLowerCase() || "unknown"

    // Skip "think" or "message" actions - they're just thoughts/messages
    if (actionName === "think" || actionName === "message") {
      const thought = actionEvent.args?.thought || actionEvent.message
      if (thought) {
        return { type: "token", text: thought }
      }
      return null
    }

    // Skip "finish" action - it's handled by finish event type
    if (actionName === "finish") {
      return null
    }

    const normalized = normalizeToolName(actionName, toolMappings)

    // Build input from args
    const input: Record<string, unknown> = {}
    if (actionEvent.args) {
      if (actionEvent.args.command) {
        input.command = actionEvent.args.command
      }
      if (actionEvent.args.path || actionEvent.args.file_path) {
        input.file_path = actionEvent.args.path || actionEvent.args.file_path
      }
      if (actionEvent.args.content) {
        input.content = actionEvent.args.content
      }
    }

    return createToolStartEvent(normalized, Object.keys(input).length > 0 ? input : undefined, toolMappings)
  }

  // Observation event - tool result
  if (json.type === "observation") {
    const obsEvent = json as OpenHandsObservationEvent
    const output = obsEvent.content || undefined
    return { type: "tool_end", output }
  }

  // Error event - emit as end with error
  if (json.type === "error") {
    const errorEvent = json as OpenHandsErrorEvent
    const errorMsg = errorEvent.message || errorEvent.error || "Unknown error"
    return { type: "end", error: errorMsg }
  }

  // Finish event - marks end of interaction
  if (json.type === "finish") {
    const finishEvent = json as OpenHandsFinishEvent
    // Check if it's a failure state
    if (finishEvent.state === "error" || finishEvent.state === "failed") {
      return { type: "end", error: finishEvent.message || "Task failed" }
    }
    return { type: "end" }
  }

  return null
}
