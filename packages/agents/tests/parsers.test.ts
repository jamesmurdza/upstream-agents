/**
 * Parser tests - these test pure data transformations from agent-specific
 * event formats to our standard Event format. No mocks, no I/O - just input/output.
 */
import { describe, it, expect } from "vitest"
import {
  parseClaudeLine,
  parseCodexLine,
  parseGeminiLine,
  parseOpencodeLine,
  parseOpenhandsLine,
  CLAUDE_TOOL_MAPPINGS,
  CODEX_TOOL_MAPPINGS,
  GEMINI_TOOL_MAPPINGS,
  OPENCODE_TOOL_MAPPINGS,
  OPENHANDS_TOOL_MAPPINGS,
} from "../src/agents/index.js"
import type { ParseContext } from "../src/core/agent.js"

// Helper to create a fresh parse context
function createContext(): ParseContext {
  return { state: {}, sessionId: null }
}

describe("parseClaudeLine", () => {
  const mappings = CLAUDE_TOOL_MAPPINGS

  it("returns null for invalid JSON", () => {
    expect(parseClaudeLine("not json", mappings)).toBeNull()
    expect(parseClaudeLine("", mappings)).toBeNull()
    expect(parseClaudeLine("{not valid json}", mappings)).toBeNull()
  })

  it("parses system init event", () => {
    const event = parseClaudeLine(
      '{"type": "system", "subtype": "init", "session_id": "abc-123"}',
      mappings
    )
    expect(event).toEqual({ type: "session", id: "abc-123" })
  })

  it("parses assistant message with text", () => {
    const event = parseClaudeLine(
      JSON.stringify({
        type: "assistant",
        message: {
          id: "msg_123",
          content: [{ type: "text", text: "Hello from Claude!" }],
        },
        session_id: "abc-123",
      }),
      mappings
    )
    expect(event).toEqual({ type: "token", text: "Hello from Claude!" })
  })

  it("parses assistant message with tool_use", () => {
    const event = parseClaudeLine(
      JSON.stringify({
        type: "assistant",
        message: {
          id: "msg_123",
          content: [{ type: "tool_use", name: "read_file" }],
        },
        session_id: "abc-123",
      }),
      mappings
    )
    expect(event).toEqual({ type: "tool_start", name: "read_file", input: {} })
  })

  it("returns null for assistant message with empty content", () => {
    const event = parseClaudeLine(
      JSON.stringify({
        type: "assistant",
        message: { id: "msg_123", content: [] },
        session_id: "abc-123",
      }),
      mappings
    )
    expect(event).toBeNull()
  })

  it("parses tool_use event", () => {
    const event = parseClaudeLine('{"type": "tool_use", "name": "bash"}', mappings)
    expect(event).toEqual({ type: "tool_start", name: "bash", input: {} })
  })

  it("parses tool_result event", () => {
    const event = parseClaudeLine(
      '{"type": "tool_result", "tool_use_id": "tool_123"}',
      mappings
    )
    expect(event).toEqual({ type: "tool_end" })
  })

  it("parses result event", () => {
    const event = parseClaudeLine(
      '{"type": "result", "subtype": "success", "result": "Done", "session_id": "abc-123"}',
      mappings
    )
    expect(event).toEqual({ type: "end" })
  })

  it("returns null for unknown event types", () => {
    expect(parseClaudeLine('{"type": "unknown_event"}', mappings)).toBeNull()
  })
})

describe("parseCodexLine", () => {
  const mappings = CODEX_TOOL_MAPPINGS

  it("returns null for invalid JSON", () => {
    expect(parseCodexLine("not json", mappings)).toBeNull()
    expect(parseCodexLine("", mappings)).toBeNull()
  })

  it("parses thread.started event", () => {
    const event = parseCodexLine(
      '{"type": "thread.started", "thread_id": "thread_abc"}',
      mappings
    )
    expect(event).toEqual({ type: "session", id: "thread_abc" })
  })

  it("parses item.message.delta event", () => {
    const event = parseCodexLine(
      '{"type": "item.message.delta", "text": "Hello"}',
      mappings
    )
    expect(event).toEqual({ type: "token", text: "Hello" })
  })

  it("parses item.tool.start event", () => {
    const event = parseCodexLine(
      '{"type": "item.tool.start", "name": "shell"}',
      mappings
    )
    expect(event).toEqual({ type: "tool_start", name: "shell", input: {} })
  })

  it("parses item.tool.input.delta event", () => {
    const event = parseCodexLine(
      '{"type": "item.tool.input.delta", "text": "ls -la"}',
      mappings
    )
    expect(event).toEqual({ type: "tool_delta", text: "ls -la" })
  })

  it("parses item.tool.end event", () => {
    const event = parseCodexLine('{"type": "item.tool.end"}', mappings)
    expect(event).toEqual({ type: "tool_end" })
  })

  it("parses turn.completed event", () => {
    const event = parseCodexLine('{"type": "turn.completed"}', mappings)
    expect(event).toEqual({ type: "end" })
  })

  it("parses turn.failed event with error", () => {
    const event = parseCodexLine(
      '{"type": "turn.failed", "error": {"message": "API rate limit exceeded"}}',
      mappings
    )
    expect(event).toEqual({ type: "end", error: "API rate limit exceeded" })
  })

  it("parses error event with message", () => {
    const event = parseCodexLine(
      '{"type": "error", "message": "unexpected status 401 Unauthorized"}',
      mappings
    )
    expect(event).toEqual({ type: "end", error: "unexpected status 401 Unauthorized" })
  })

  it("returns null for unknown event types", () => {
    expect(parseCodexLine('{"type": "unknown.event"}', mappings)).toBeNull()
  })
})

describe("parseGeminiLine", () => {
  const mappings = GEMINI_TOOL_MAPPINGS

  it("returns null for invalid JSON", () => {
    const ctx = createContext()
    expect(parseGeminiLine("not json", mappings, ctx)).toBeNull()
    expect(parseGeminiLine("", mappings, ctx)).toBeNull()
  })

  it("parses init event", () => {
    const ctx = createContext()
    const event = parseGeminiLine(
      '{"type": "init", "session_id": "gemini_session"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "session", id: "gemini_session" })
  })

  it("parses assistant.delta event", () => {
    const ctx = createContext()
    const event = parseGeminiLine(
      '{"type": "assistant.delta", "text": "Sure, I can help"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "token", text: "Sure, I can help" })
  })

  it("parses tool.start event and normalizes name", () => {
    const ctx = createContext()
    const event = parseGeminiLine(
      '{"type": "tool.start", "name": "execute_code"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_start", name: "shell", input: {} })
  })

  it("parses tool.delta event", () => {
    const ctx = createContext()
    const event = parseGeminiLine(
      '{"type": "tool.delta", "text": "running..."}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_delta", text: "running..." })
  })

  it("parses tool.end event with accumulated output", () => {
    const ctx = createContext()
    parseGeminiLine('{"type": "tool.start", "name": "write_file"}', mappings, ctx)
    parseGeminiLine('{"type": "tool.delta", "text": "done"}', mappings, ctx)
    const event = parseGeminiLine('{"type": "tool.end"}', mappings, ctx)
    expect(event).toEqual({ type: "tool_end", output: "done" })
  })

  it("parses assistant.complete event", () => {
    const ctx = createContext()
    const event = parseGeminiLine('{"type": "assistant.complete"}', mappings, ctx)
    expect(event).toEqual({ type: "end" })
  })

  it("returns null for unknown event types", () => {
    const ctx = createContext()
    expect(parseGeminiLine('{"type": "unknown"}', mappings, ctx)).toBeNull()
  })
})

describe("parseOpencodeLine", () => {
  const mappings = OPENCODE_TOOL_MAPPINGS

  it("returns null for invalid JSON", () => {
    const ctx = createContext()
    expect(parseOpencodeLine("not json", mappings, ctx)).toBeNull()
    expect(parseOpencodeLine("", mappings, ctx)).toBeNull()
  })

  it("parses step_start event", () => {
    const ctx = createContext()
    const event = parseOpencodeLine(
      '{"type": "step_start", "sessionID": "ses_xyz123"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "session", id: "ses_xyz123" })
  })

  it("parses text event with content", () => {
    const ctx = createContext()
    const event = parseOpencodeLine(
      '{"type": "text", "sessionID": "ses_xyz123", "part": {"type": "text", "text": "Processing..."}}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "token", text: "Processing..." })
  })

  it("returns null for text event without text type", () => {
    const ctx = createContext()
    const event = parseOpencodeLine(
      '{"type": "text", "sessionID": "ses_xyz123", "part": {"type": "image"}}',
      mappings,
      ctx
    )
    expect(event).toBeNull()
  })

  it("returns null for text event without text content", () => {
    const ctx = createContext()
    const event = parseOpencodeLine(
      '{"type": "text", "sessionID": "ses_xyz123", "part": {"type": "text"}}',
      mappings,
      ctx
    )
    expect(event).toBeNull()
  })

  it("parses tool_call event", () => {
    const ctx = createContext()
    const event = parseOpencodeLine(
      '{"type": "tool_call", "sessionID": "ses_xyz123", "part": {"type": "tool-call", "tool": "write_file"}}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_start", name: "write_file", input: {} })
  })

  it("handles tool_call with missing tool name", () => {
    const ctx = createContext()
    const event = parseOpencodeLine(
      '{"type": "tool_call", "sessionID": "ses_xyz123", "part": {"type": "tool-call"}}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_start", name: "unknown", input: {} })
  })

  it("parses tool_result event", () => {
    const ctx = createContext()
    const event = parseOpencodeLine(
      '{"type": "tool_result", "sessionID": "ses_xyz123"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_end" })
  })

  it("parses step_finish event", () => {
    const ctx = createContext()
    const event = parseOpencodeLine(
      '{"type": "step_finish", "sessionID": "ses_xyz123", "part": {"reason": "stop"}}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "end" })
  })

  it("parses error event with error message", () => {
    const ctx = createContext()
    const event = parseOpencodeLine(
      '{"type": "error", "sessionID": "ses_xyz123", "error": {"name": "APIError", "data": {"message": "Rate limit exceeded"}}}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "end", error: "Rate limit exceeded" })
  })

  it("parses error event falling back to error name", () => {
    const ctx = createContext()
    const event = parseOpencodeLine(
      '{"type": "error", "sessionID": "ses_xyz123", "error": {"name": "APIError"}}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "end", error: "APIError" })
  })

  it("returns null for unknown event types", () => {
    const ctx = createContext()
    expect(parseOpencodeLine('{"type": "unknown"}', mappings, ctx)).toBeNull()
  })
})

describe("parseOpenhandsLine", () => {
  const mappings = OPENHANDS_TOOL_MAPPINGS

  it("returns null for invalid JSON", () => {
    const ctx = createContext()
    expect(parseOpenhandsLine("not json", mappings, ctx)).toBeNull()
    expect(parseOpenhandsLine("", mappings, ctx)).toBeNull()
    expect(parseOpenhandsLine("{not valid json}", mappings, ctx)).toBeNull()
  })

  it("parses status event with session_id", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "status", "session_id": "conv_abc123"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "session", id: "conv_abc123" })
    expect(ctx.sessionId).toBe("conv_abc123")
  })

  it("parses status event with conversation_id", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "status", "conversation_id": "conv_xyz789"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "session", id: "conv_xyz789" })
  })

  it("does not re-emit session event for same session_id", () => {
    const ctx = createContext()
    ctx.sessionId = "conv_abc123"
    const event = parseOpenhandsLine(
      '{"type": "status", "session_id": "conv_abc123"}',
      mappings,
      ctx
    )
    expect(event).toBeNull()
  })

  it("parses message event from assistant", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "message", "role": "assistant", "content": "Hello, I can help you with that!"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "token", text: "Hello, I can help you with that!" })
  })

  it("parses message event with message field instead of content", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "message", "role": "assistant", "message": "Processing your request..."}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "token", text: "Processing your request..." })
  })

  it("returns null for non-assistant message", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "message", "role": "user", "content": "Do something"}',
      mappings,
      ctx
    )
    expect(event).toBeNull()
  })

  it("parses action event for run command", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "action", "action": "run", "args": {"command": "ls -la"}}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_start", name: "shell", input: { command: "ls -la" } })
  })

  it("parses action event for write file", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "action", "action": "write", "args": {"path": "/tmp/test.txt", "content": "hello"}}',
      mappings,
      ctx
    )
    expect(event).toEqual({
      type: "tool_start",
      name: "write",
      input: { file_path: "/tmp/test.txt", content: "hello" },
    })
  })

  it("parses action event for read file with file_path", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "action", "action": "read", "args": {"file_path": "/tmp/test.txt"}}',
      mappings,
      ctx
    )
    expect(event).toEqual({
      type: "tool_start",
      name: "read",
      input: { file_path: "/tmp/test.txt" },
    })
  })

  it("converts think action to token event", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "action", "action": "think", "args": {"thought": "Let me analyze this..."}}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "token", text: "Let me analyze this..." })
  })

  it("converts message action to token event", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "action", "action": "message", "message": "I found the issue"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "token", text: "I found the issue" })
  })

  it("returns null for finish action (handled by finish event type)", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "action", "action": "finish"}',
      mappings,
      ctx
    )
    expect(event).toBeNull()
  })

  it("parses observation event with content", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "observation", "content": "file.txt\\nother.txt"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_end", output: "file.txt\nother.txt" })
  })

  it("parses observation event without content", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "observation"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_end" })
  })

  it("parses error event", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "error", "message": "API rate limit exceeded"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "end", error: "API rate limit exceeded" })
  })

  it("parses error event with error field", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "error", "error": "Connection failed"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "end", error: "Connection failed" })
  })

  it("parses error event with default message", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "error"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "end", error: "Unknown error" })
  })

  it("parses finish event successfully", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "finish", "state": "success"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "end" })
  })

  it("parses finish event with error state", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "finish", "state": "error", "message": "Task could not be completed"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "end", error: "Task could not be completed" })
  })

  it("parses finish event with failed state", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "finish", "state": "failed"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "end", error: "Task failed" })
  })

  it("returns null for unknown event types", () => {
    const ctx = createContext()
    expect(parseOpenhandsLine('{"type": "unknown"}', mappings, ctx)).toBeNull()
  })

  it("normalizes bash action to shell", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "action", "action": "bash", "args": {"command": "echo hello"}}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_start", name: "shell", input: { command: "echo hello" } })
  })

  it("normalizes str_replace_editor to edit", () => {
    const ctx = createContext()
    const event = parseOpenhandsLine(
      '{"type": "action", "action": "str_replace_editor", "args": {"path": "/tmp/file.txt"}}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_start", name: "edit", input: { file_path: "/tmp/file.txt" } })
  })
})
