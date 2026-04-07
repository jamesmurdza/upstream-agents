/**
 * Agents module - registers all built-in agents
 *
 * Import this module to register all agents with the registry.
 */

import { registry } from "../core/registry.js"
import { claudeAgent } from "./claude/index.js"
import { codexAgent } from "./codex/index.js"
import { geminiAgent } from "./gemini/index.js"
import { gooseAgent } from "./goose/index.js"
import { kimiAgent } from "./kimi/index.js"
import { opencodeAgent } from "./opencode/index.js"
import { piAgent } from "./pi/index.js"

// Register all built-in agents
registry.register(claudeAgent)
registry.register(codexAgent)
registry.register(geminiAgent)
registry.register(gooseAgent)
registry.register(kimiAgent)
registry.register(opencodeAgent)
registry.register(piAgent)

// Export agent definitions for direct import if needed
export { claudeAgent } from "./claude/index.js"
export { codexAgent } from "./codex/index.js"
export { geminiAgent } from "./gemini/index.js"
export { gooseAgent } from "./goose/index.js"
export { kimiAgent } from "./kimi/index.js"
export { opencodeAgent } from "./opencode/index.js"
export { piAgent } from "./pi/index.js"

// Re-export tool mappings for testing
export { CLAUDE_TOOL_MAPPINGS } from "./claude/tools.js"
export { CODEX_TOOL_MAPPINGS } from "./codex/tools.js"
export { GEMINI_TOOL_MAPPINGS } from "./gemini/tools.js"
export { GOOSE_TOOL_MAPPINGS } from "./goose/tools.js"
export { KIMI_TOOL_MAPPINGS } from "./kimi/tools.js"
export { OPENCODE_TOOL_MAPPINGS } from "./opencode/tools.js"
export { PI_TOOL_MAPPINGS } from "./pi/tools.js"

// Re-export parsers for testing
export { parseClaudeLine } from "./claude/parser.js"
export { parseCodexLine } from "./codex/parser.js"
export { parseGeminiLine } from "./gemini/parser.js"
export { parseGooseLine } from "./goose/parser.js"
export { parseKimiLine } from "./kimi/parser.js"
export { parseOpencodeLine } from "./opencode/parser.js"
export { parsePiLine } from "./pi/parser.js"
