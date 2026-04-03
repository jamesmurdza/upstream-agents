/**
 * Goose CLI output parser
 *
 * Pure function for parsing Goose CLI stream-json output.
 * Goose uses SSE-style streaming with JSON events.
 */

import type { Event } from "../../types/events.js"
import { createToolStartEvent } from "../../core/tools.js"
import { safeJsonParse } from "../../utils/json.js"

/**
 * Raw event types from Goose's stream-json output
 *
 * Based on Goose server's MessageEvent enum and Message structure.
 * Goose streams events as JSON objects with a "type" discriminator.
 */

/**
 * Content block types within a Message
 */
interface GooseTextContent {
  Text: {
    text: string
  }
}

interface GooseToolRequest {
  ToolRequest: {
    id: string
    tool_call: {
      Ok?: {
        name: string
        arguments: Record<string, unknown>
      }
      Err?: {
        message?: string
      }
    }
  }
}

interface GooseToolResponse {
  ToolResponse: {
    id: string
    tool_result: {
      Ok?: Array<{ type: string; text?: string }>
      Err?: string
    }
  }
}

type GooseContentBlock = GooseTextContent | GooseToolRequest | GooseToolResponse

/**
 * Message event containing role and content
 */
interface GooseMessageEvent {
  type: "Message"
  Message: {
    role: "assistant" | "user"
    created: number
    content: GooseContentBlock[]
  }
}

/**
 * Finish event marking completion
 */
interface GooseFinishEvent {
  type: "Finish"
  Finish: {
    reason: string
  }
}

/**
 * Error event
 */
interface GooseErrorEvent {
  type: "Error"
  Error: string
}

/**
 * Notification event (for session updates, tool calls, etc.)
 */
interface GooseNotificationEvent {
  type: "Notification"
  Notification: {
    request_id?: string
    notification?: unknown
  }
}

/**
 * Ping keepalive event
 */
interface GoosePingEvent {
  type: "Ping"
}

type GooseEvent =
  | GooseMessageEvent
  | GooseFinishEvent
  | GooseErrorEvent
  | GooseNotificationEvent
  | GoosePingEvent

/**
 * Parse a line of Goose CLI output into event(s).
 *
 * @param line - Raw line from CLI output
 * @param toolMappings - Tool name mappings for this agent
 * @returns Event, array of events, or null if line should be ignored
 */
export function parseGooseLine(
  line: string,
  toolMappings: Record<string, string>
): Event | Event[] | null {
  // Strip SSE "data: " prefix if present
  const trimmedLine = line.startsWith("data: ") ? line.slice(6) : line

  const json = safeJsonParse<GooseEvent>(trimmedLine)
  if (!json) {
    return null
  }

  // Message event containing role and content blocks
  if (json.type === "Message" && json.Message) {
    const msg = json.Message
    const events: Event[] = []

    for (const block of msg.content) {
      // Text content from assistant
      if ("Text" in block && msg.role === "assistant") {
        events.push({ type: "token", text: block.Text.text })
      }

      // Tool request (tool call starting)
      if ("ToolRequest" in block) {
        const req = block.ToolRequest
        if (req.tool_call.Ok) {
          events.push(
            createToolStartEvent(
              req.tool_call.Ok.name,
              req.tool_call.Ok.arguments,
              toolMappings
            )
          )
        } else if (req.tool_call.Err) {
          // Tool call error - emit as token with error message
          events.push({
            type: "token",
            text: `[Tool error: ${req.tool_call.Err.message ?? "Unknown error"}]`,
          })
        }
      }

      // Tool response (tool call completed)
      if ("ToolResponse" in block) {
        const res = block.ToolResponse
        let output: string | undefined

        if (res.tool_result.Ok) {
          // Extract text from successful result
          const textParts = res.tool_result.Ok
            .filter((part) => part.type === "text" && part.text)
            .map((part) => part.text)
          output = textParts.join("\n") || undefined
        } else if (res.tool_result.Err) {
          output = `Error: ${res.tool_result.Err}`
        }

        events.push({ type: "tool_end", output })
      }
    }

    return events.length > 0 ? (events.length === 1 ? events[0] : events) : null
  }

  // Finish event marks completion
  if (json.type === "Finish") {
    return { type: "end" }
  }

  // Error event
  if (json.type === "Error") {
    return { type: "end", error: json.Error }
  }

  // Ping and Notification events are ignored
  return null
}
