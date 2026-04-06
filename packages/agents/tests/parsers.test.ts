/**
 * Parser tests - these test pure data transformations from agent-specific
 * event formats to our standard Event format. No mocks, no I/O - just input/output.
 */
import { describe, it, expect } from "vitest"
import {
  parseClaudeLine,
  parseClaurstLine,
  parseCodexLine,
  parseGeminiLine,
  parseOpencodeLine,
  CLAUDE_TOOL_MAPPINGS,
  CLAURST_TOOL_MAPPINGS,
  CODEX_TOOL_MAPPINGS,
  GEMINI_TOOL_MAPPINGS,
  OPENCODE_TOOL_MAPPINGS,
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

describe("parseClaurstLine", () => {
  const mappings = CLAURST_TOOL_MAPPINGS

  it("returns null for invalid JSON", () => {
    expect(parseClaurstLine("not json", mappings)).toBeNull()
    expect(parseClaurstLine("", mappings)).toBeNull()
    expect(parseClaurstLine("{not valid json}", mappings)).toBeNull()
  })

  it("parses system init event (Claude Code style)", () => {
    const event = parseClaurstLine(
      '{"type": "system", "subtype": "init", "session_id": "claurst-abc-123"}',
      mappings
    )
    expect(event).toEqual({ type: "session", id: "claurst-abc-123" })
  })

  it("parses init event (ClauRST style)", () => {
    const event = parseClaurstLine(
      '{"type": "init", "session_id": "claurst-xyz-789"}',
      mappings
    )
    expect(event).toEqual({ type: "session", id: "claurst-xyz-789" })
  })

  it("parses assistant message with text", () => {
    const event = parseClaurstLine(
      JSON.stringify({
        type: "assistant",
        message: {
          id: "msg_123",
          content: [{ type: "text", text: "Hello from ClauRST!" }],
        },
        session_id: "abc-123",
      }),
      mappings
    )
    expect(event).toEqual({ type: "token", text: "Hello from ClauRST!" })
  })

  it("parses assistant message with tool_use", () => {
    const event = parseClaurstLine(
      JSON.stringify({
        type: "assistant",
        message: {
          id: "msg_123",
          content: [{ type: "tool_use", name: "FileRead" }],
        },
        session_id: "abc-123",
      }),
      mappings
    )
    expect(event).toEqual({ type: "tool_start", name: "read", input: {} })
  })

  it("returns null for assistant message with empty content", () => {
    const event = parseClaurstLine(
      JSON.stringify({
        type: "assistant",
        message: { id: "msg_123", content: [] },
        session_id: "abc-123",
      }),
      mappings
    )
    expect(event).toBeNull()
  })

  it("parses message.delta event", () => {
    const event = parseClaurstLine(
      '{"type": "message.delta", "text": "Streaming text..."}',
      mappings
    )
    expect(event).toEqual({ type: "token", text: "Streaming text..." })
  })

  it("parses assistant.delta event", () => {
    const event = parseClaurstLine(
      '{"type": "assistant.delta", "text": "More streaming text"}',
      mappings
    )
    expect(event).toEqual({ type: "token", text: "More streaming text" })
  })

  it("parses assistant.delta event with content field", () => {
    const event = parseClaurstLine(
      '{"type": "assistant.delta", "content": "Content field text"}',
      mappings
    )
    expect(event).toEqual({ type: "token", text: "Content field text" })
  })

  it("returns null for delta event without text or content", () => {
    const event = parseClaurstLine(
      '{"type": "message.delta"}',
      mappings
    )
    expect(event).toBeNull()
  })

  it("parses tool_use event", () => {
    const event = parseClaurstLine(
      '{"type": "tool_use", "name": "Bash", "input": {"command": "ls -la"}}',
      mappings
    )
    expect(event).toMatchObject({ type: "tool_start", name: "shell" })
  })

  it("parses tool.start event", () => {
    const event = parseClaurstLine(
      '{"type": "tool.start", "name": "Write", "input": {"file_path": "/test.txt"}}',
      mappings
    )
    expect(event).toMatchObject({ type: "tool_start", name: "write" })
  })

  it("parses tool_start event (underscore variant)", () => {
    const event = parseClaurstLine(
      '{"type": "tool_start", "name": "Grep"}',
      mappings
    )
    expect(event).toEqual({ type: "tool_start", name: "grep", input: {} })
  })

  it("parses tool.delta event", () => {
    const event = parseClaurstLine(
      '{"type": "tool.delta", "text": "executing..."}',
      mappings
    )
    expect(event).toEqual({ type: "tool_delta", text: "executing..." })
  })

  it("parses tool_delta event (underscore variant)", () => {
    const event = parseClaurstLine(
      '{"type": "tool_delta", "text": "running command..."}',
      mappings
    )
    expect(event).toEqual({ type: "tool_delta", text: "running command..." })
  })

  it("parses tool.end event", () => {
    const event = parseClaurstLine(
      '{"type": "tool.end", "output": "file created"}',
      mappings
    )
    expect(event).toEqual({ type: "tool_end", output: "file created" })
  })

  it("parses tool_end event with result field", () => {
    const event = parseClaurstLine(
      '{"type": "tool_end", "result": "command output"}',
      mappings
    )
    expect(event).toEqual({ type: "tool_end", output: "command output" })
  })

  it("parses tool_result event", () => {
    const event = parseClaurstLine(
      '{"type": "tool_result", "tool_use_id": "tool_123", "result": "output text"}',
      mappings
    )
    expect(event).toEqual({ type: "tool_end", output: "output text" })
  })

  it("parses tool_result event with content array", () => {
    const event = parseClaurstLine(
      '{"type": "tool_result", "tool_use_id": "tool_123", "content": [{"type": "text", "text": "array content"}]}',
      mappings
    )
    expect(event).toEqual({ type: "tool_end", output: "array content" })
  })

  it("parses tool result inside user message", () => {
    const event = parseClaurstLine(
      JSON.stringify({
        type: "user",
        message: {
          content: [{ type: "tool_result", content: "user message tool result" }],
        },
      }),
      mappings
    )
    expect(event).toEqual({ type: "tool_end", output: "user message tool result" })
  })

  it("parses complete event", () => {
    const event = parseClaurstLine(
      '{"type": "complete", "status": "success"}',
      mappings
    )
    expect(event).toEqual({ type: "end" })
  })

  it("parses assistant.complete event", () => {
    const event = parseClaurstLine(
      '{"type": "assistant.complete"}',
      mappings
    )
    expect(event).toEqual({ type: "end" })
  })

  it("parses message.complete event", () => {
    const event = parseClaurstLine(
      '{"type": "message.complete"}',
      mappings
    )
    expect(event).toEqual({ type: "end" })
  })

  it("parses complete event with error status", () => {
    const event = parseClaurstLine(
      '{"type": "complete", "status": "error", "error": "Something went wrong"}',
      mappings
    )
    expect(event).toEqual({ type: "end", error: "Something went wrong" })
  })

  it("parses error event with message", () => {
    const event = parseClaurstLine(
      '{"type": "error", "message": "API error occurred"}',
      mappings
    )
    expect(event).toEqual({ type: "end", error: "API error occurred" })
  })

  it("parses error event with error field", () => {
    const event = parseClaurstLine(
      '{"type": "error", "error": "Connection failed"}',
      mappings
    )
    expect(event).toEqual({ type: "end", error: "Connection failed" })
  })

  it("parses result event (success)", () => {
    const event = parseClaurstLine(
      '{"type": "result", "subtype": "success", "result": "Done", "session_id": "abc-123"}',
      mappings
    )
    expect(event).toEqual({ type: "end" })
  })

  it("parses result event (error)", () => {
    const event = parseClaurstLine(
      '{"type": "result", "subtype": "error", "error": "Task failed", "session_id": "abc-123"}',
      mappings
    )
    expect(event).toEqual({ type: "end", error: "Task failed" })
  })

  it("parses result event (error_during_execution)", () => {
    const event = parseClaurstLine(
      '{"type": "result", "subtype": "error_during_execution", "error": "Execution error", "session_id": "abc-123"}',
      mappings
    )
    expect(event).toEqual({ type: "end", error: "Execution error" })
  })

  it("returns null for unknown event types", () => {
    expect(parseClaurstLine('{"type": "unknown_event"}', mappings)).toBeNull()
  })

  it("normalizes tool names using mappings", () => {
    // Test FileWrite -> write
    const writeEvent = parseClaurstLine(
      '{"type": "tool_use", "name": "FileWrite"}',
      mappings
    )
    expect(writeEvent).toMatchObject({ type: "tool_start", name: "write" })

    // Test PtyBashTool -> shell
    const shellEvent = parseClaurstLine(
      '{"type": "tool_use", "name": "PtyBashTool"}',
      mappings
    )
    expect(shellEvent).toMatchObject({ type: "tool_start", name: "shell" })

    // Test GlobTool -> glob
    const globEvent = parseClaurstLine(
      '{"type": "tool_use", "name": "GlobTool"}',
      mappings
    )
    expect(globEvent).toMatchObject({ type: "tool_start", name: "glob" })

    // Test WebSearchTool -> web_search
    const webEvent = parseClaurstLine(
      '{"type": "tool_use", "name": "WebSearchTool"}',
      mappings
    )
    expect(webEvent).toMatchObject({ type: "tool_start", name: "web_search" })
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
