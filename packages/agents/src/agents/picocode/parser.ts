/**
 * Picocode CLI output parser
 *
 * Parses Picocode CLI plain text output. Picocode outputs:
 * 1. ASCII art banner with version/model info
 * 2. A separator line
 * 3. The response text
 * 4. Then exits (no explicit end marker)
 *
 * Since picocode doesn't emit an "end" event, the SDK will detect completion
 * via the process exiting. We need to emit session and token events.
 */

import type { Event } from "../../types/events.js"
import type { ParseContext } from "../../core/agent.js"
import { createToolStartEvent, normalizeToolName } from "../../core/tools.js"

// Pattern for tool invocation header (e.g., "── read_file ──────────────────────")
const TOOL_HEADER_REGEX = /^──\s+(\w+)\s+─+$/

// Pattern for the picocode banner line (contains "picocode |")
const BANNER_REGEX = /picocode\s*\|/

// Pattern for error messages (picocode outputs "Error: ..." for errors)
const ERROR_REGEX = /^Error:\s*(.+)$/i

// Pattern for API/HTTP errors (often multiline, check for key phrases)
const API_ERROR_PATTERNS = [
  /invalid.*api.*key/i,
  /unauthorized/i,
  /authentication.*error/i,
  /credit.*balance/i,
  /rate.*limit/i,
]

// Pattern for separator lines (used after banner and between sections)
const SEPARATOR_REGEX = /^[─═]{10,}$/

// Pattern for the ASCII art (contains box-drawing characters in specific pattern)
const ASCII_ART_REGEX = /^[\s▄█░▀│┌┐└┘├┤┬┴┼]+$/

/**
 * Parse a line of Picocode CLI output into event(s).
 */
export function parsePicocodeLine(
  line: string,
  toolMappings: Record<string, string>,
  context: ParseContext
): Event | Event[] | null {
  const trimmedLine = line.trim()
  if (!trimmedLine) return null

  // Initialize state
  if (!context.state.initialized) {
    context.state.initialized = true
    context.state.seenBanner = false
    context.state.seenSeparator = false
    context.state.inResponse = false
  }

  // Check for error first (highest priority)
  const errorMatch = ERROR_REGEX.exec(trimmedLine)
  if (errorMatch) {
    return { type: "end", error: errorMatch[1] }
  }

  // Check for API error patterns in any line
  for (const pattern of API_ERROR_PATTERNS) {
    if (pattern.test(trimmedLine)) {
      return { type: "end", error: trimmedLine }
    }
  }

  // Skip ASCII art lines
  if (ASCII_ART_REGEX.test(trimmedLine)) {
    return null
  }

  // Check for the banner line (contains "picocode |")
  if (BANNER_REGEX.test(trimmedLine)) {
    context.state.seenBanner = true
    // Emit session event when we see the banner
    if (!context.sessionId) {
      const sessionId = `picocode-${Date.now()}`
      context.sessionId = sessionId
      return { type: "session", id: sessionId }
    }
    return null
  }

  // Check for separator line
  if (SEPARATOR_REGEX.test(trimmedLine)) {
    if (context.state.seenBanner && !context.state.seenSeparator) {
      context.state.seenSeparator = true
      context.state.inResponse = true
    }
    return null
  }

  // Check for tool header (e.g., "── read_file ──────────────────────")
  const toolMatch = TOOL_HEADER_REGEX.exec(trimmedLine)
  if (toolMatch) {
    const toolName = toolMatch[1]
    context.state.lastToolStarted = true
    return createToolStartEvent(
      normalizeToolName(toolName, toolMappings),
      undefined,
      toolMappings
    )
  }

  // If we're in the response section, emit tokens
  if (context.state.inResponse) {
    // Skip lines that look like UI elements
    if (trimmedLine.startsWith(">") || trimmedLine.startsWith("─")) {
      return null
    }
    context.state.hasOutput = true
    return { type: "token", text: trimmedLine + "\n" }
  }

  // Before the separator, check if this might be an early response
  // (some simple prompts might not have much header)
  if (context.state.seenBanner && !context.state.seenSeparator) {
    // This could be part of the banner info, skip it
    return null
  }

  return null
}
