import type { Event, ProviderCommand, ProviderName, ProviderOptions, RunOptions } from "../types/index.js"
import { createToolStartEvent } from "../types/events.js"
import { safeJsonParse } from "../utils/json.js"
import { Provider } from "./base.js"

/**
 * Raw event types from Claude CLI's stream-json output
 */
interface ClaudeSystemInit {
  type: "system"
  subtype: "init"
  session_id: string
}

interface ClaudeAssistantMessage {
  type: "assistant"
  message: {
    id: string
    content: Array<{
      type: "text" | "tool_use"
      text?: string
      name?: string
      input?: unknown
    }>
  }
  session_id: string
}

interface ClaudeResult {
  type: "result"
  subtype?: "success" | "error" | "error_during_execution" | "error_max_turns"
  result?: string
  error?: string
  session_id: string
}

interface ClaudeToolUse {
  type: "tool_use"
  name: string
  input?: unknown
}

interface ClaudeToolResult {
  type: "tool_result"
  tool_use_id: string
  result?: string
  content?: string | Array<{ type: string; text?: string }>
}

interface ClaudeUserMessage {
  type: "user"
  message?: { content?: Array<{ type: string; tool_use_id?: string; content?: string | Array<{ type: string; text?: string }> }> }
}

type ClaudeEvent =
  | ClaudeSystemInit
  | ClaudeAssistantMessage
  | ClaudeUserMessage
  | ClaudeResult
  | ClaudeToolUse
  | ClaudeToolResult

// Canonical names: read, edit, write, glob, grep, shell (full set, lowercase)
const CLAUDE_TOOL_NAME_MAP: Record<string, string> = {
  Write: "write",
  Read: "read",
  Edit: "edit",
  Glob: "glob",
  Grep: "grep",
  Bash: "shell",
  WebSearch: "web_search",
}

function normalizeClaudeToolName(name: string): string {
  return CLAUDE_TOOL_NAME_MAP[name] ?? name.toLowerCase()
}

/**
 * Claude Code CLI provider
 *
 * Interacts with the Claude CLI tool which outputs JSON lines in stream-json format
 */
export class ClaudeProvider extends Provider {
  readonly name: ProviderName = "claude"

  constructor(options: ProviderOptions) {
    super(options)
  }

  getCommand(options?: RunOptions): ProviderCommand {
    const args: string[] = []

    // Print mode for non-interactive usage
    args.push("-p")

    // Add output format flag for JSON streaming (requires --verbose)
    args.push("--output-format", "stream-json", "--verbose")

    // Skip permission prompts when already running in a sandbox
    args.push("--dangerously-skip-permissions")

    // Apply system prompt via native CLI flag when provided.
    if (options?.systemPrompt) {
      args.push("--system-prompt", options.systemPrompt)
    }

    // Add model if specified (e.g., "sonnet", "opus", "claude-sonnet-4-5-20250929")
    if (options?.model) {
      args.push("--model", options.model)
    }

    if (this.sessionId || options?.sessionId) {
      args.push("--resume", this.sessionId || options!.sessionId!)
    }

    // Add the prompt if provided
    if (options?.prompt) {
      args.push(options.prompt)
    }

    return {
      cmd: "claude",
      args,
      env: options?.env,
    }
  }

  parse(line: string): Event | Event[] | null {
    const json = safeJsonParse<ClaudeEvent>(line)
    if (!json) {
      return null
    }

    // System init event contains session ID
    if (json.type === "system" && "subtype" in json && json.subtype === "init") {
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
            return createToolStartEvent(normalizeClaudeToolName(block.name), block.input)
          }
        }
      }
      return null
    }

    // Tool use event
    if (json.type === "tool_use" && "name" in json) {
      return createToolStartEvent(normalizeClaudeToolName(json.name), json.input)
    }

    // Tool result (standalone or inside user message)
    function toolResultOutput(obj: ClaudeToolResult): string | undefined {
      let out = obj.result
      if (out === undefined && obj.content !== undefined) {
        if (typeof obj.content === "string") out = obj.content
        else if (Array.isArray(obj.content) && obj.content[0]?.text) out = obj.content[0].text
      }
      return out
    }
    if (json.type === "tool_result") {
      return { type: "tool_end", output: toolResultOutput(json) }
    }
    if (json.type === "user" && json.message?.content) {
      for (const block of json.message.content) {
        if (block.type === "tool_result") {
          let out: string | undefined
          if (typeof block.content === "string") out = block.content
          else if (Array.isArray(block.content) && block.content[0]?.text) out = block.content[0].text
          return { type: "tool_end", output: out }
        }
      }
    }

    // Result event marks end of interaction (success or CLI error)
    if (json.type === "result") {
      const err =
        (json as ClaudeResult).subtype === "error_during_execution" ||
        (json as ClaudeResult).subtype === "error"
          ? (json as ClaudeResult).error ?? (json as ClaudeResult).result ?? "Unknown error"
          : undefined
      return { type: "end", ...(err ? { error: err } : {}) }
    }

    return null
  }
}
