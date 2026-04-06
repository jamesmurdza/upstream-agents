/**
 * OpenHands CLI Agent Definition
 *
 * OpenHands is an AI-powered coding agent that can edit files, run commands,
 * and browse the web. This integration uses the headless CLI mode with JSON output.
 *
 * @see https://docs.openhands.dev/openhands/usage/cli/headless
 */

import type {
  AgentDefinition,
  CommandSpec,
  ParseContext,
  RunOptions,
} from "../../core/agent.js"
import type { Event } from "../../types/events.js"
import { parseOpenhandsLine } from "./parser.js"
import { OPENHANDS_TOOL_MAPPINGS } from "./tools.js"

/**
 * Quote a string for bash
 */
function quote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

/**
 * OpenHands CLI agent definition.
 *
 * Interacts with the OpenHands CLI tool in headless mode with JSON output.
 * Wraps command in bash to capture stderr and handle environment properly.
 */
export const openhandsAgent: AgentDefinition = {
  name: "openhands",

  toolMappings: OPENHANDS_TOOL_MAPPINGS,

  capabilities: {
    supportsSystemPrompt: false,
    supportsResume: true,
  },

  buildCommand(options: RunOptions): CommandSpec {
    // Build the openhands command
    // --always-approve auto-approves tool calls in headless mode
    const parts: string[] = ["openhands", "--headless", "--json", "--always-approve"]

    // Add model if specified
    // OpenHands uses LLM_MODEL env var, but we can use --override-with-envs flag
    // along with environment variables for model selection

    // Resume session if provided
    if (options.sessionId) {
      parts.push("--resume", quote(options.sessionId))
    }

    // Add the prompt via -t flag
    if (options.prompt) {
      parts.push("-t", quote(options.prompt))
    }

    // Redirect stderr to stdout for unified output capture
    const command = `${parts.join(" ")} 2>&1`

    // Build environment variables
    const env: Record<string, string> = {
      // Suppress the banner for cleaner JSON output
      OPENHANDS_SUPPRESS_BANNER: "1",
      ...options.env,
    }

    // If model is specified, set the LLM_MODEL env var
    if (options.model) {
      env.LLM_MODEL = options.model
    }

    return {
      cmd: "bash",
      args: ["-lc", command],
      env,
      wrapInBash: false, // Already wrapped
    }
  },

  parse(line: string, context: ParseContext): Event | null {
    return parseOpenhandsLine(line, this.toolMappings, context)
  },
}
