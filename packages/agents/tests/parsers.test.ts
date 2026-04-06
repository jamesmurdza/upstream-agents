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
  parsePiLine,
  CLAUDE_TOOL_MAPPINGS,
  CODEX_TOOL_MAPPINGS,
  GEMINI_TOOL_MAPPINGS,
  OPENCODE_TOOL_MAPPINGS,
  PI_TOOL_MAPPINGS,
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

describe("parsePiLine", () => {
  const mappings = PI_TOOL_MAPPINGS

  it("returns null for invalid JSON", () => {
    const ctx = createContext()
    expect(parsePiLine("not json", mappings, ctx)).toBeNull()
    expect(parsePiLine("", mappings, ctx)).toBeNull()
  })

  it("parses session header event", () => {
    const ctx = createContext()
    const event = parsePiLine(
      '{"type": "session", "version": 3, "id": "pi_session_123", "timestamp": "2025-01-01T00:00:00Z", "cwd": "/home/user"}',
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "session", id: "pi_session_123" })
  })

  it("parses message_update with text_delta using delta field", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "message_update",
        message: {},
        assistantMessageEvent: {
          type: "text_delta",
          delta: "Hello from Pi!",
        },
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "token", text: "Hello from Pi!" })
  })

  it("parses message_update with text_delta using text field", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "message_update",
        message: {},
        assistantMessageEvent: {
          type: "text_delta",
          text: "Alternative text",
        },
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "token", text: "Alternative text" })
  })

  it("returns null for message_update without text_delta", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "message_update",
        message: {},
        assistantMessageEvent: {
          type: "other_event",
        },
      }),
      mappings,
      ctx
    )
    expect(event).toBeNull()
  })

  it("parses tool_execution_start event", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "tool_execution_start",
        toolCallId: "tool_123",
        toolName: "bash",
        args: { command: "ls -la" },
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({
      type: "tool_start",
      name: "shell",
      input: { command: "ls -la" },
    })
  })

  it("parses tool_execution_start event with read tool", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "tool_execution_start",
        toolCallId: "tool_456",
        toolName: "read",
        args: { file_path: "/path/to/file.ts" },
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({
      type: "tool_start",
      name: "read",
      input: { file_path: "/path/to/file.ts" },
    })
  })

  it("handles tool_execution_start with missing tool name", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "tool_execution_start",
        toolCallId: "tool_789",
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_start", name: "unknown", input: {} })
  })

  it("parses tool_execution_update event with string result", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "tool_execution_update",
        toolCallId: "tool_123",
        toolName: "bash",
        partialResult: "partial output...",
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_delta", text: "partial output..." })
  })

  it("parses tool_execution_update event with object result", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "tool_execution_update",
        toolCallId: "tool_123",
        toolName: "read",
        partialResult: { content: "file content" },
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({
      type: "tool_delta",
      text: '{"content":"file content"}',
    })
  })

  it("returns null for tool_execution_update without partialResult", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "tool_execution_update",
        toolCallId: "tool_123",
        toolName: "bash",
      }),
      mappings,
      ctx
    )
    expect(event).toBeNull()
  })

  it("parses tool_execution_end event with string result", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "tool_execution_end",
        toolCallId: "tool_123",
        toolName: "bash",
        result: "command output",
        isError: false,
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_end", output: "command output" })
  })

  it("parses tool_execution_end event with object result", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "tool_execution_end",
        toolCallId: "tool_123",
        toolName: "read",
        result: { lines: 100 },
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_end", output: '{"lines":100}' })
  })

  it("parses tool_execution_end event without result", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "tool_execution_end",
        toolCallId: "tool_123",
        toolName: "write",
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "tool_end" })
  })

  it("parses agent_end event", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "agent_end",
        messages: [],
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "end" })
  })

  it("parses error event with error field", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "error",
        error: "Rate limit exceeded",
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "end", error: "Rate limit exceeded" })
  })

  it("parses error event with message field", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "error",
        message: "Connection failed",
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "end", error: "Connection failed" })
  })

  it("parses auto_retry_end failure event", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "auto_retry_end",
        success: false,
        attempt: 3,
        finalError: "Max retries exceeded",
      }),
      mappings,
      ctx
    )
    expect(event).toEqual({ type: "end", error: "Max retries exceeded" })
  })

  it("returns null for auto_retry_end success event", () => {
    const ctx = createContext()
    const event = parsePiLine(
      JSON.stringify({
        type: "auto_retry_end",
        success: true,
        attempt: 2,
      }),
      mappings,
      ctx
    )
    expect(event).toBeNull()
  })

  it("returns null for agent_start event", () => {
    const ctx = createContext()
    expect(
      parsePiLine('{"type": "agent_start"}', mappings, ctx)
    ).toBeNull()
  })

  it("returns null for turn_start event", () => {
    const ctx = createContext()
    expect(parsePiLine('{"type": "turn_start"}', mappings, ctx)).toBeNull()
  })

  it("returns null for turn_end event", () => {
    const ctx = createContext()
    expect(
      parsePiLine('{"type": "turn_end", "message": {}}', mappings, ctx)
    ).toBeNull()
  })

  it("returns null for message_start event", () => {
    const ctx = createContext()
    expect(
      parsePiLine('{"type": "message_start", "message": {}}', mappings, ctx)
    ).toBeNull()
  })

  it("returns null for message_end event", () => {
    const ctx = createContext()
    expect(
      parsePiLine('{"type": "message_end", "message": {}}', mappings, ctx)
    ).toBeNull()
  })

  it("returns null for unknown event types", () => {
    const ctx = createContext()
    expect(parsePiLine('{"type": "unknown"}', mappings, ctx)).toBeNull()
  })
})
