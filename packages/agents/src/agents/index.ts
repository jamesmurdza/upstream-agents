/**
 * Agents module - registers all built-in agents
 *
 * Import this module to register all agents with the registry.
 */

import { registry } from "../core/registry"
import { claudeAgent } from "./claude/index"
import { codexAgent } from "./codex/index"
import { geminiAgent } from "./gemini/index"
import { gooseAgent } from "./goose/index"
import { opencodeAgent } from "./opencode/index"
import { piAgent } from "./pi/index"

// Register all built-in agents
registry.register(claudeAgent)
registry.register(codexAgent)
registry.register(geminiAgent)
registry.register(gooseAgent)
registry.register(opencodeAgent)
registry.register(piAgent)

// Export agent definitions for direct import if needed
export { claudeAgent } from "./claude/index"
export { codexAgent } from "./codex/index"
export { geminiAgent } from "./gemini/index"
export { gooseAgent } from "./goose/index"
export { opencodeAgent } from "./opencode/index"
export { piAgent } from "./pi/index"

// Re-export tool mappings for testing
export { CLAUDE_TOOL_MAPPINGS } from "./claude/tools"
export { CODEX_TOOL_MAPPINGS } from "./codex/tools"
export { GEMINI_TOOL_MAPPINGS } from "./gemini/tools"
export { GOOSE_TOOL_MAPPINGS } from "./goose/tools"
export { OPENCODE_TOOL_MAPPINGS } from "./opencode/tools"
export { PI_TOOL_MAPPINGS } from "./pi/tools"

// Re-export parsers for testing
export { parseClaudeLine } from "./claude/parser"
export { parseCodexLine } from "./codex/parser"
export { parseGeminiLine } from "./gemini/parser"
export { parseGooseLine } from "./goose/parser"
export { parseOpencodeLine } from "./opencode/parser"
export { parsePiLine } from "./pi/parser"
