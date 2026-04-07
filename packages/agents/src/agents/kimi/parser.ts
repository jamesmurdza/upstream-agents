/**
 * Kimi Code CLI output parser
 *
 * Pure function for parsing Kimi CLI stream-json output.
 * Kimi outputs newline-delimited JSON messages in a role-based format.
 *
 * Format (from --output-format=stream-json):
 * - {"role":"assistant","content":"...[","tool_calls":[...]}
 * - {"role":"tool","tool_call_id":"...","content":"..."}
 *
 * Tool calls use function calling format:
 * {"tool_calls":[{"type":"function","id":"tc_1","function":{"name":"Shell","arguments":"{...}"}}]}
 */

import type { Event } from "../../types/events.js"
import type { ParseContext } from "../../core/agent.js"
import { createToolStartEvent } from "../../core/tools.js"
import { safeJsonParse } from "../../utils/json.js"

/**
 * Tool call structure within assistant messages
 */
interface KimiToolCall {
  type: "function"
  id: string
  function: {
    name: string
    arguments: string
  }
}

/**
 * Assistant message - contains response text and/or tool calls
 */
interface KimiAssistantMessage {
  role: "assistant"
  content?: string
  tool_calls?: KimiToolCall[]
}

/**
 * Tool result message - contains tool execution output
 */
interface KimiToolMessage {
  role: "tool"
  tool_call_id: string
  content: string
}

/**
 * User message (typically echoed in stream-json mode)
 */
interface KimiUserMessage {
  role: "user"
  content: string | Array<{ type: string; text?: string }>
}

type KimiMessage = KimiAssistantMessage | KimiToolMessage | KimiUserMessage

/**
 * Parse a line of Kimi CLI output into event(s).
 *
 * @param line - Raw line from CLI output
 * @param toolMappings - Tool name mappings for this agent
 * @param context - Parse context for session tracking
 * @returns Event, array of events, or null if line should be ignored
 */
export function parseKimiLine(
  line: string,
  toolMappings: Record<string, string>,
  context?: ParseContext
): Event | Event[] | null {
  const json = safeJsonParse<KimiMessage>(line)
  if (!json || !json.role) {
    return null
  }

  // User messages are ignored (they're just echo of input)
  if (json.role === "user") {
    return null
  }

  // Tool result message
  if (json.role === "tool") {
    const toolMsg = json as KimiToolMessage
    return {
      type: "tool_end",
      output: toolMsg.content || undefined,
    }
  }

  // Assistant message
  if (json.role === "assistant") {
    const assistantMsg = json as KimiAssistantMessage
    const events: Event[] = []

    // Emit session event on first assistant message if not already emitted
    // Kimi doesn't provide a dedicated session ID, so we generate one
    if (context && !context.state.sessionEmitted) {
      context.state.sessionEmitted = true
      const sessionId = `kimi-${Date.now()}`
      context.sessionId = sessionId
      events.push({ type: "session", id: sessionId })
    }

    // Text content from assistant
    if (assistantMsg.content) {
      events.push({ type: "token", text: assistantMsg.content })
    }

    // Tool calls
    if (assistantMsg.tool_calls && assistantMsg.tool_calls.length > 0) {
      for (const toolCall of assistantMsg.tool_calls) {
        if (toolCall.type === "function" && toolCall.function) {
          const toolName = toolCall.function.name
          let input: unknown = {}

          // Parse the arguments JSON string
          if (toolCall.function.arguments) {
            const parsed = safeJsonParse<Record<string, unknown>>(
              toolCall.function.arguments
            )
            if (parsed) {
              input = parsed
            }
          }

          events.push(createToolStartEvent(toolName, input, toolMappings))
        }
      }
    }

    // If this is the final assistant message without tool calls, it signals completion
    // However, we need to detect end of stream differently since Kimi doesn't have
    // an explicit end event in print mode - the process just exits

    return events.length > 0
      ? events.length === 1
        ? events[0]
        : events
      : null
  }

  return null
}
