/**
 * Letta Code CLI Agent Definition
 *
 * Letta Code is a coding agent CLI that provides stateful, memory-enabled
 * AI assistance for development tasks. It runs in isolated sandboxes
 * and uses stream-json output format.
 */

import type { AgentDefinition, CommandSpec, ParseContext, RunOptions } from "../../core/agent.js"
import type { Event } from "../../types/events.js"
import { parseLettaLine } from "./parser.js"
import { LETTA_TOOL_MAPPINGS } from "./tools.js"

/**
 * Letta Code CLI agent definition.
 *
 * Interacts with the Letta Code CLI tool which outputs JSON lines in stream-json format.
 * Supports custom system prompts and runs in yolo mode for autonomous execution.
 */
export const lettaAgent: AgentDefinition = {
  name: "letta",

  toolMappings: LETTA_TOOL_MAPPINGS,

  capabilities: {
    supportsSystemPrompt: true,
    supportsResume: false, // Letta uses PTY-based sessions, not CLI session resumption
  },

  buildCommand(options: RunOptions): CommandSpec {
    const args: string[] = []

    // Start a new session
    args.push("--new")

    // Add custom system prompt if provided
    if (options.systemPrompt) {
      args.push("--system-custom", options.systemPrompt)
    }

    // Enable JSON streaming input/output for machine-readable events
    args.push("--input-format", "stream-json")
    args.push("--output-format", "stream-json")

    // Enable yolo mode for autonomous execution without confirmation prompts
    args.push("--yolo")

    // Print mode for non-interactive usage
    args.push("-p")

    // Add the prompt if provided
    if (options.prompt) {
      args.push(options.prompt)
    }

    return {
      cmd: "letta",
      args,
      env: options.env,
    }
  },

  parse(line: string, context: ParseContext): Event | Event[] | null {
    return parseLettaLine(line, this.toolMappings, context)
  },
}
