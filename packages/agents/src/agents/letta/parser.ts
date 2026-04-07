/**
 * Letta Code CLI output parser
 *
 * Pure function for parsing Letta Code CLI stream-json output.
 * Letta Code outputs newline-delimited JSON events.
 *
 * Based on the Daytona guide output format:
 * - {"type":"system","subtype":"init"} for session init
 * - {"type":"message","message_type":"approval_request_message","tool_call":{...}} for tool calls
 * - {"type":"message","message_type":"stop_reason",...} for stop reasons
 * - {"type":"result","result":"..."} for final result
 */

import type { Event } from "../../types/events.js"
import type { ParseContext } from "../../core/agent.js"
import { createToolStartEvent } from "../../core/tools.js"
import { safeJsonParse } from "../../utils/json.js"

/**
 * Tool call object within approval_request_message
 */
interface LettaToolCall {
  tool_call_id?: string
  name?: string
  arguments?: string
}

/**
 * System init event
 */
interface LettaSystemMessage {
  type: "system"
  subtype?: "init"
}

/**
 * Reasoning message (internal thinking)
 */
interface LettaReasoningMessage {
  type: "message"
  message_type: "reasoning_message"
  reasoning: string
  uuid?: string
  seq_id?: number
}

/**
 * Assistant message (text output)
 */
interface LettaAssistantMessage {
  type: "message"
  message_type: "assistant_message"
  content: string
  uuid?: string
  seq_id?: number
}

/**
 * Approval request message (tool call)
 */
interface LettaApprovalRequestMessage {
  type: "message"
  message_type: "approval_request_message"
  tool_call: LettaToolCall
  uuid?: string
  seq_id?: number
}

/**
 * Stop reason message
 */
interface LettaStopReasonMessage {
  type: "message"
  message_type: "stop_reason"
  stop_reason: string
  uuid?: string
  seq_id?: number
}

/**
 * Result message (final output)
 */
interface LettaResultMessage {
  type: "result"
  result: string
  otid?: string
  seq_id?: number
}

/**
 * Error event
 */
interface LettaErrorMessage {
  type: "error"
  error?: string | { message: string; code?: string }
  message?: string
}

type LettaEvent =
  | LettaSystemMessage
  | LettaReasoningMessage
  | LettaAssistantMessage
  | LettaApprovalRequestMessage
  | LettaStopReasonMessage
  | LettaResultMessage
  | LettaErrorMessage

/**
 * Parse tool arguments from JSON string
 */
function parseToolArguments(argsStr: string | undefined): Record<string, unknown> {
  if (!argsStr) return {}
  try {
    return JSON.parse(argsStr)
  } catch {
    return {}
  }
}

/**
 * Parse a line of Letta Code CLI output into event(s).
 *
 * @param line - Raw line from CLI output
 * @param toolMappings - Tool name mappings for this agent
 * @param context - Parse context for session tracking
 * @returns Event, array of events, or null if line should be ignored
 */
export function parseLettaLine(
  line: string,
  toolMappings: Record<string, string>,
  context?: ParseContext
): Event | Event[] | null {
  const json = safeJsonParse<LettaEvent>(line)
  if (!json) {
    return null
  }

  // System init event signals session start
  if (json.type === "system") {
    if ("subtype" in json && json.subtype === "init") {
      // Letta doesn't provide a session ID in init, generate one
      const sessionId = `letta-${Date.now()}`
      if (context) {
        context.sessionId = sessionId
        context.state.initialized = true
      }
      return { type: "session", id: sessionId }
    }
    return null
  }

  // Message events with different message_type
  if (json.type === "message" && "message_type" in json) {
    // Assistant message contains text output
    if (json.message_type === "assistant_message" && "content" in json) {
      const content = (json as LettaAssistantMessage).content
      if (content) {
        return { type: "token", text: content }
      }
      return null
    }

    // Reasoning message (internal thinking) - emit as token for visibility
    if (json.message_type === "reasoning_message" && "reasoning" in json) {
      // Skip reasoning messages as they are internal
      return null
    }

    // Approval request message contains tool call
    if (json.message_type === "approval_request_message" && "tool_call" in json) {
      const toolCall = (json as LettaApprovalRequestMessage).tool_call
      if (toolCall && toolCall.name) {
        const args = parseToolArguments(toolCall.arguments)
        return createToolStartEvent(toolCall.name, args, toolMappings)
      }
      return null
    }

    // Stop reason message indicates tool call completion
    if (json.message_type === "stop_reason") {
      return { type: "tool_end" }
    }

    return null
  }

  // Result message contains the final output
  if (json.type === "result" && "result" in json) {
    // Result signals end of interaction
    return { type: "end" }
  }

  // Error event
  if (json.type === "error") {
    const errorMsg =
      typeof json.error === "string"
        ? json.error
        : json.error?.message ?? json.message ?? "Unknown error"
    return { type: "end", error: errorMsg }
  }

  return null
}
