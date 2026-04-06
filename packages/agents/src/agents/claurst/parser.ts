/**
 * ClauRST CLI output parser
 *
 * Pure function for parsing ClauRST CLI JSON output.
 * ClauRST is a Rust reimplementation of Claude Code, so it uses a similar
 * stream-json output format with some variations.
 *
 * No state, no side effects - easily testable.
 */

import type { Event } from "../../types/events.js"
import { createToolStartEvent } from "../../core/tools.js"
import { safeJsonParse } from "../../utils/json.js"

/**
 * Raw event types from ClauRST CLI's stream-json output
 */
interface ClaurstSystemInit {
  type: "system"
  subtype: "init"
  session_id: string
}

interface ClaurstAssistantMessage {
  type: "assistant"
  message: {
    id: string
    content: Array<{
      type: "text" | "tool_use" | "thinking"
      text?: string
      name?: string
      input?: unknown
    }>
  }
  session_id: string
}

interface ClaurstResult {
  type: "result"
  subtype?: "success" | "error" | "error_during_execution" | "error_max_turns"
  result?: string
  error?: string
  session_id: string
}

interface ClaurstToolUse {
  type: "tool_use"
  name: string
  input?: unknown
}

interface ClaurstToolResult {
  type: "tool_result"
  tool_use_id: string
  result?: string
  content?: string | Array<{ type: string; text?: string }>
}

interface ClaurstUserMessage {
  type: "user"
  message?: {
    content?: Array<{
      type: string
      tool_use_id?: string
      content?: string | Array<{ type: string; text?: string }>
    }>
  }
}

// Additional ClauRST-specific event types
interface ClaurstInit {
  type: "init"
  session_id: string
}

interface ClaurstMessageDelta {
  type: "message.delta" | "assistant.delta"
  text?: string
  content?: string
}

interface ClaurstToolStart {
  type: "tool.start" | "tool_start"
  name: string
  input?: unknown
}

interface ClaurstToolDelta {
  type: "tool.delta" | "tool_delta"
  text?: string
}

interface ClaurstToolEnd {
  type: "tool.end" | "tool_end"
  output?: string
  result?: string
}

interface ClaurstComplete {
  type: "complete" | "assistant.complete" | "message.complete"
  status?: "success" | "error"
  error?: string
}

interface ClaurstError {
  type: "error"
  message?: string
  error?: string
}

type ClaurstEvent =
  | ClaurstSystemInit
  | ClaurstAssistantMessage
  | ClaurstUserMessage
  | ClaurstResult
  | ClaurstToolUse
  | ClaurstToolResult
  | ClaurstInit
  | ClaurstMessageDelta
  | ClaurstToolStart
  | ClaurstToolDelta
  | ClaurstToolEnd
  | ClaurstComplete
  | ClaurstError

/**
 * Extract output from a tool result object
 */
function toolResultOutput(obj: ClaurstToolResult): string | undefined {
  let out = obj.result
  if (out === undefined && obj.content !== undefined) {
    if (typeof obj.content === "string") out = obj.content
    else if (Array.isArray(obj.content) && obj.content[0]?.text)
      out = obj.content[0].text
  }
  return out
}

/**
 * Parse a line of ClauRST CLI output into event(s).
 *
 * @param line - Raw line from CLI output
 * @param toolMappings - Tool name mappings for this agent
 * @returns Event, array of events, or null if line should be ignored
 */
export function parseClaurstLine(
  line: string,
  toolMappings: Record<string, string>
): Event | Event[] | null {
  const json = safeJsonParse<ClaurstEvent>(line)
  if (!json) {
    return null
  }

  // System init event contains session ID (Claude Code style)
  if (json.type === "system" && "subtype" in json && json.subtype === "init") {
    return { type: "session", id: json.session_id }
  }

  // Simple init event (ClauRST style)
  if (json.type === "init" && "session_id" in json) {
    return { type: "session", id: json.session_id }
  }

  // Assistant message contains the response content
  if (json.type === "assistant" && "message" in json) {
    const content = json.message.content
    if (content && content.length > 0) {
      // Find text content and emit as token
      for (const block of content) {
        if (block.type === "text" && block.text) {
          return { type: "token", text: block.text }
        }
        if (block.type === "tool_use" && block.name) {
          return createToolStartEvent(block.name, block.input, toolMappings)
        }
      }
    }
    return null
  }

  // Message delta (streaming text)
  if (
    (json.type === "message.delta" || json.type === "assistant.delta") &&
    ("text" in json || "content" in json)
  ) {
    const text = json.text ?? json.content
    if (text) {
      return { type: "token", text }
    }
    return null
  }

  // Tool use event (standalone)
  if (json.type === "tool_use" && "name" in json) {
    return createToolStartEvent(json.name, json.input, toolMappings)
  }

  // Tool start events
  if ((json.type === "tool.start" || json.type === "tool_start") && "name" in json) {
    return createToolStartEvent(json.name, json.input, toolMappings)
  }

  // Tool delta (streaming tool output)
  if ((json.type === "tool.delta" || json.type === "tool_delta") && "text" in json) {
    return { type: "tool_delta", text: json.text ?? "" }
  }

  // Tool end events
  if (json.type === "tool.end" || json.type === "tool_end") {
    const output = "output" in json ? json.output : "result" in json ? json.result : undefined
    return { type: "tool_end", output }
  }

  // Tool result (standalone)
  if (json.type === "tool_result") {
    return { type: "tool_end", output: toolResultOutput(json) }
  }

  // Tool result inside user message
  if (json.type === "user" && json.message?.content) {
    for (const block of json.message.content) {
      if (block.type === "tool_result") {
        let out: string | undefined
        if (typeof block.content === "string") out = block.content
        else if (Array.isArray(block.content) && block.content[0]?.text)
          out = block.content[0].text
        return { type: "tool_end", output: out }
      }
    }
  }

  // Complete events (ClauRST style)
  if (
    json.type === "complete" ||
    json.type === "assistant.complete" ||
    json.type === "message.complete"
  ) {
    if ("status" in json && json.status === "error") {
      return { type: "end", error: json.error ?? "Unknown error" }
    }
    return { type: "end" }
  }

  // Error event
  if (json.type === "error") {
    const errorMsg = json.message ?? json.error ?? "Unknown error"
    return { type: "end", error: errorMsg }
  }

  // Result event marks end of interaction (success or CLI error)
  if (json.type === "result") {
    const err =
      (json as ClaurstResult).subtype === "error_during_execution" ||
      (json as ClaurstResult).subtype === "error"
        ? ((json as ClaurstResult).error ??
          (json as ClaurstResult).result ??
          "Unknown error")
        : undefined
    return { type: "end", ...(err ? { error: err } : {}) }
  }

  return null
}
