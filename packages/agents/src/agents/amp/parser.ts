/**
 * Amp Code CLI output parser
 *
 * Pure function for parsing Amp Code CLI stream-json output.
 * Amp Code outputs newline-delimited JSON events similar to Claude Code.
 *
 * Based on the Daytona guide output format:
 * - {"type":"system","subtype":"init","session":"<id>"} for session init
 * - {"type":"assistant","content":[...]} for assistant messages with text/tool_use
 * - {"type":"user","content":[...]} for user messages with tool_result
 * - {"type":"result","subtype":"success|error",...} for completion
 */

import type { Event } from "../../types/events.js"
import type { ParseContext } from "../../core/agent.js"
import { createToolStartEvent } from "../../core/tools.js"
import { safeJsonParse } from "../../utils/json.js"

/**
 * Content block types within messages
 */
interface AmpTextContent {
  type: "text"
  text: string
}

interface AmpToolUseContent {
  type: "tool_use"
  id: string
  name: string
  input?: Record<string, unknown>
}

interface AmpToolResultContent {
  type: "tool_result"
  tool_use_id: string
  content?: string | Array<{ type: string; text?: string }>
  is_error?: boolean
}

type AmpContentBlock = AmpTextContent | AmpToolUseContent | AmpToolResultContent

/**
 * System init event
 */
interface AmpSystemInit {
  type: "system"
  subtype: "init"
  session?: string
  session_id?: string
}

/**
 * Assistant message event
 */
interface AmpAssistantMessage {
  type: "assistant"
  content: AmpContentBlock[]
  session?: string
}

/**
 * User message event (typically contains tool results)
 */
interface AmpUserMessage {
  type: "user"
  content: AmpContentBlock[]
}

/**
 * Result event marking completion
 */
interface AmpResultEvent {
  type: "result"
  subtype?: "success" | "error" | "error_during_execution"
  result?: string
  error?: string
  session?: string
  duration_ms?: number
  usage?: {
    input_tokens?: number
    output_tokens?: number
  }
}

/**
 * Error event
 */
interface AmpErrorEvent {
  type: "error"
  error?: string | { message: string; code?: string }
  message?: string
}

type AmpEvent =
  | AmpSystemInit
  | AmpAssistantMessage
  | AmpUserMessage
  | AmpResultEvent
  | AmpErrorEvent

/**
 * Extract output from a tool result content block
 */
function extractToolResultOutput(
  content?: string | Array<{ type: string; text?: string }>
): string | undefined {
  if (typeof content === "string") {
    return content || undefined
  }
  if (Array.isArray(content)) {
    const textParts = content
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text)
    return textParts.join("\n") || undefined
  }
  return undefined
}

/**
 * Parse a line of Amp Code CLI output into event(s).
 *
 * @param line - Raw line from CLI output
 * @param toolMappings - Tool name mappings for this agent
 * @param context - Parse context for session tracking
 * @returns Event, array of events, or null if line should be ignored
 */
export function parseAmpLine(
  line: string,
  toolMappings: Record<string, string>,
  context?: ParseContext
): Event | Event[] | null {
  const json = safeJsonParse<AmpEvent>(line)
  if (!json) {
    return null
  }

  // System init event contains session ID
  if (json.type === "system" && "subtype" in json && json.subtype === "init") {
    const sessionId = json.session || json.session_id
    if (sessionId) {
      if (context) {
        context.sessionId = sessionId
      }
      return { type: "session", id: sessionId }
    }
    return null
  }

  // Assistant message contains the response content
  if (json.type === "assistant" && "content" in json && Array.isArray(json.content)) {
    const events: Event[] = []

    for (const block of json.content) {
      // Text content
      if (block.type === "text" && "text" in block && block.text) {
        events.push({ type: "token", text: block.text })
      }

      // Tool use (tool call starting)
      if (block.type === "tool_use" && "name" in block) {
        events.push(createToolStartEvent(block.name, block.input, toolMappings))
      }
    }

    return events.length > 0 ? (events.length === 1 ? events[0] : events) : null
  }

  // User message typically contains tool results
  if (json.type === "user" && "content" in json && Array.isArray(json.content)) {
    const events: Event[] = []

    for (const block of json.content) {
      if (block.type === "tool_result") {
        const output = extractToolResultOutput(block.content)
        const finalOutput = block.is_error && output ? `Error: ${output}` : output
        events.push({ type: "tool_end", output: finalOutput })
      }
    }

    return events.length > 0 ? (events.length === 1 ? events[0] : events) : null
  }

  // Result event marks end of interaction
  if (json.type === "result") {
    const isError =
      json.subtype === "error" || json.subtype === "error_during_execution"
    const errorMsg = isError ? (json.error ?? json.result ?? "Unknown error") : undefined
    return { type: "end", ...(errorMsg ? { error: errorMsg } : {}) }
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
