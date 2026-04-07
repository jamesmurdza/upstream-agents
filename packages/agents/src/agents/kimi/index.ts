/**
 * Kimi Code CLI Agent Definition
 *
 * Kimi Code CLI is an AI agent that runs in the terminal from MoonshotAI.
 * https://github.com/MoonshotAI/kimi-cli
 */

import type {
  AgentDefinition,
  CommandSpec,
  ParseContext,
  RunOptions,
} from "../../core/agent.js"
import type { Event } from "../../types/events.js"
import { parseKimiLine } from "./parser.js"
import { KIMI_TOOL_MAPPINGS } from "./tools.js"

/**
 * Kimi Code CLI agent definition.
 *
 * Interacts with the Kimi CLI tool which outputs JSON lines in stream-json format.
 * Uses --print mode for non-interactive execution with --output-format=stream-json.
 */
export const kimiAgent: AgentDefinition = {
  name: "kimi",

  toolMappings: KIMI_TOOL_MAPPINGS,

  capabilities: {
    supportsSystemPrompt: false, // Kimi doesn't have a system prompt flag in print mode
    supportsResume: true,
  },

  buildCommand(options: RunOptions): CommandSpec {
    const args: string[] = []

    // Use print mode for non-interactive execution
    // Print mode implicitly enables --yolo (auto-approve all operations)
    args.push("--print")

    // Output in stream-json format for machine-readable events
    args.push("--output-format", "stream-json")

    // Add model if specified
    if (options.model) {
      args.push("--model", options.model)
    }

    // Session handling:
    // --continue: Resume the previous session in the current working directory
    // --session ID / --resume ID: Resume a specific session
    if (options.sessionId) {
      args.push("--continue")
    }

    // Add the prompt via -p flag
    if (options.prompt) {
      args.push("-p", options.prompt)
    }

    // Build the kimi command string
    const kimiCmd = ["kimi", ...args]
      .map((arg) => {
        return `'${arg.replace(/'/g, "'\\''")}'`
      })
      .join(" ")

    // Wrap in bash to ensure PATH includes ~/.local/bin where kimi may be installed
    return {
      cmd: "bash",
      args: ["-c", `export PATH="$HOME/.local/bin:$PATH" && ${kimiCmd}`],
      env: options.env,
    }
  },

  parse(line: string, context: ParseContext): Event | Event[] | null {
    return parseKimiLine(line, this.toolMappings, context)
  },
}
