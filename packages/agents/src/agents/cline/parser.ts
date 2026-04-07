/**
 * Cline CLI output parser
 *
 * Pure function for parsing Cline CLI JSON output.
 * Cline outputs JSON lines when run with --json flag.
 */

import type { Event } from "../../types/events.js"
import type { ShellToolInput } from "../../types/events.js"
import { createToolStartEvent } from "../../core/tools.js"
import { safeJsonParse } from "../../utils/json.js"
import { normalizeClineToolName } from "./tools.js"
import type { ParseContext } from "../../core/agent.js"

/**
 * Raw event types from Cline's JSON stream
 *
 * Based on Cline CLI documentation, the output format includes:
 * - Session/init events
 * - Message/text events
 * - Tool use events
 * - Tool result events
 * - Completion events
 */

interface ClineInitEvent {
  type: "init" | "session"
  session_id?: string
  sessionId?: string
  id?: string
}

interface ClineMessageDelta {
  type: "message" | "text" | "assistant" | "content_block_delta"
  text?: string
  content?: string
  delta?: {
    type?: string
    text?: string
  }
  role?: string
}

interface ClineToolUse {
  type: "tool_use" | "tool_call" | "tool_start"
  name?: string
  tool?: string
  tool_name?: string
  id?: string
  input?: Record<string, unknown>
  arguments?: Record<string, unknown>
  parameters?: Record<string, unknown>
}

interface ClineToolResult {
  type: "tool_result" | "tool_end" | "tool_response"
  tool_use_id?: string
  id?: string
  output?: string
  result?: string | { content?: string; text?: string }
  content?: string | Array<{ type: string; text?: string }>
  is_error?: boolean
}

interface ClineComplete {
  type: "result" | "complete" | "end" | "done" | "turn_complete"
  status?: string
  subtype?: string
}

interface ClineError {
  type: "error"
  message?: string
  error?: string | { message?: string }
}

type ClineEvent =
  | ClineInitEvent
  | ClineMessageDelta
  | ClineToolUse
  | ClineToolResult
  | ClineComplete
  | ClineError

/**
 * Parse a line of Cline CLI output into event(s).
 */
export function parseClineLine(
  line: string,
  toolMappings: Record<string, string>,
  _context?: ParseContext
): Event | Event[] | null {
  // Strip SSE data prefix if present
  const trimmed = line.startsWith("data: ") ? line.slice(6) : line

  const json = safeJsonParse<ClineEvent>(trimmed)
  if (!json) {
    return null
  }

  // Session/init events
  if (json.type === "init" || json.type === "session") {
    const sessionId =
      (json as ClineInitEvent).session_id ||
      (json as ClineInitEvent).sessionId ||
      (json as ClineInitEvent).id
    if (sessionId) {
      return { type: "session", id: sessionId }
    }
    return null
  }

  // Message/text delta events
  if (
    json.type === "message" ||
    json.type === "text" ||
    json.type === "assistant" ||
    json.type === "content_block_delta"
  ) {
    const msg = json as ClineMessageDelta

    // Skip user messages
    if (msg.role === "user") {
      return null
    }

    // Extract text from various possible locations
    let text: string | undefined
    if (msg.text) {
      text = msg.text
    } else if (msg.content && typeof msg.content === "string") {
      text = msg.content
    } else if (msg.delta?.text) {
      text = msg.delta.text
    }

    if (text) {
      return { type: "token", text }
    }
    return null
  }

  // Tool use/start events
  if (
    json.type === "tool_use" ||
    json.type === "tool_call" ||
    json.type === "tool_start"
  ) {
    const toolEvent = json as ClineToolUse
    const name =
      toolEvent.name || toolEvent.tool || toolEvent.tool_name || "unknown"
    const normalizedName = normalizeClineToolName(name)

    // Extract input from various possible locations
    let input: unknown =
      toolEvent.input || toolEvent.arguments || toolEvent.parameters || {}

    // Handle shell/command tool specially
    if (normalizedName === "shell" && typeof input === "object" && input !== null) {
      const inputObj = input as Record<string, unknown>
      if (typeof inputObj.command === "string") {
        input = { command: inputObj.command } satisfies ShellToolInput
      }
    }

    return createToolStartEvent(normalizedName, input, toolMappings)
  }

  // Tool result/end events
  if (
    json.type === "tool_result" ||
    json.type === "tool_end" ||
    json.type === "tool_response"
  ) {
    const resultEvent = json as ClineToolResult

    // Extract output from various possible locations
    let output: string | undefined

    if (resultEvent.output) {
      output = resultEvent.output
    } else if (resultEvent.result) {
      if (typeof resultEvent.result === "string") {
        output = resultEvent.result
      } else if (resultEvent.result.content) {
        output = resultEvent.result.content
      } else if (resultEvent.result.text) {
        output = resultEvent.result.text
      }
    } else if (resultEvent.content) {
      if (typeof resultEvent.content === "string") {
        output = resultEvent.content
      } else if (Array.isArray(resultEvent.content)) {
        const textBlock = resultEvent.content.find((b) => b.type === "text")
        if (textBlock?.text) {
          output = textBlock.text
        }
      }
    }

    // Handle error results
    if (resultEvent.is_error && output) {
      output = `Error: ${output}`
    }

    return { type: "tool_end", output }
  }

  // Completion events
  if (
    json.type === "result" ||
    json.type === "complete" ||
    json.type === "end" ||
    json.type === "done" ||
    json.type === "turn_complete"
  ) {
    return { type: "end" }
  }

  // Error events
  if (json.type === "error") {
    const errorEvent = json as ClineError
    let errorMessage: string | undefined

    if (errorEvent.message) {
      errorMessage = errorEvent.message
    } else if (typeof errorEvent.error === "string") {
      errorMessage = errorEvent.error
    } else if (
      typeof errorEvent.error === "object" &&
      errorEvent.error?.message
    ) {
      errorMessage = errorEvent.error.message
    }

    return { type: "end", error: errorMessage }
  }

  return null
}
