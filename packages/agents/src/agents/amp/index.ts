/**
 * Amp Code CLI Agent Definition
 *
 * Amp Code is a coding agent CLI that uses the Anthropic API.
 * It supports execute mode with paid credits for autonomous coding.
 */

import type { AgentDefinition, CommandSpec, ParseContext, RunOptions } from "../../core/agent.js"
import type { Event } from "../../types/events.js"
import { parseAmpLine } from "./parser.js"
import { AMP_TOOL_MAPPINGS } from "./tools.js"

/**
 * Amp Code CLI agent definition.
 *
 * Interacts with the Amp Code CLI tool which outputs JSON lines in stream-json format.
 * Uses PTY-based streaming with thread management for conversation continuity.
 */
export const ampAgent: AgentDefinition = {
  name: "amp",

  toolMappings: AMP_TOOL_MAPPINGS,

  capabilities: {
    supportsSystemPrompt: true,
    supportsResume: true,
  },

  buildCommand(options: RunOptions): CommandSpec {
    const args: string[] = []

    // If resuming a session (thread), use the threads continue subcommand
    if (options.sessionId) {
      args.push("threads", "continue", options.sessionId)
    } else {
      // Start a new execution with the prompt
      args.push("exec")
    }

    // Add output format for JSON streaming
    args.push("--json")

    // Add model if specified
    if (options.model) {
      args.push("--model", options.model)
    }

    // Add system prompt if provided (for new sessions)
    if (options.systemPrompt && !options.sessionId) {
      args.push("--system", options.systemPrompt)
    }

    // Add the prompt if provided (for new sessions or continuing threads)
    if (options.prompt) {
      args.push(options.prompt)
    }

    return {
      cmd: "amp",
      args,
      env: options.env,
    }
  },

  parse(line: string, context: ParseContext): Event | Event[] | null {
    return parseAmpLine(line, this.toolMappings, context)
  },
}
