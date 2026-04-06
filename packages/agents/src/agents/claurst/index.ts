/**
 * ClauRST CLI Agent Definition
 *
 * ClauRST is a clean-room Rust reimplementation of Claude Code.
 * It provides a compatible CLI interface with similar output format.
 */

import type { AgentDefinition, CommandSpec, ParseContext, RunOptions } from "../../core/agent.js"
import type { Event } from "../../types/events.js"
import { parseClaurstLine } from "./parser.js"
import { CLAURST_TOOL_MAPPINGS } from "./tools.js"

/**
 * ClauRST CLI agent definition.
 *
 * Interacts with the ClauRST CLI tool which outputs JSON lines in stream-json format.
 * The CLI interface is similar to Claude Code since ClauRST is a reimplementation.
 */
export const claurstAgent: AgentDefinition = {
  name: "claurst",

  toolMappings: CLAURST_TOOL_MAPPINGS,

  capabilities: {
    supportsSystemPrompt: true,
    supportsResume: true,
  },

  buildCommand(options: RunOptions): CommandSpec {
    const args: string[] = []

    // Print mode for non-interactive usage
    args.push("-p")

    // Add output format flag for JSON streaming (requires --verbose)
    args.push("--output-format", "stream-json", "--verbose")

    // Skip permission prompts when already running in a sandbox
    args.push("--dangerously-skip-permissions")

    // Apply system prompt via native CLI flag when provided
    if (options.systemPrompt) {
      args.push("--system-prompt", options.systemPrompt)
    }

    // Add model if specified (e.g., "sonnet", "opus", "claude-sonnet-4-5-20250929")
    if (options.model) {
      args.push("--model", options.model)
    }

    // Resume session if provided
    if (options.sessionId) {
      args.push("--resume", options.sessionId)
    }

    // Add the prompt if provided
    if (options.prompt) {
      args.push(options.prompt)
    }

    return {
      cmd: "claurst",
      args,
      env: options.env,
    }
  },

  parse(line: string, _context: ParseContext): Event | Event[] | null {
    return parseClaurstLine(line, this.toolMappings)
  },
}
