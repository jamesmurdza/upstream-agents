/**
 * Cline CLI Agent Definition
 *
 * Cline is a CLI-based AI coding agent that supports multiple providers
 * including Anthropic, OpenAI, and others.
 *
 * @see https://docs.cline.bot/cline-cli/getting-started
 */

import type {
  AgentDefinition,
  CommandSpec,
  ParseContext,
  RunOptions,
} from "../../core/agent.js"
import type { Event } from "../../types/events.js"
import type { CodeAgentSandbox } from "../../types/provider.js"
import { parseClineLine } from "./parser.js"
import { CLINE_TOOL_MAPPINGS } from "./tools.js"

/**
 * Cline agent-specific setup: authenticate with API key
 *
 * Cline supports multiple authentication methods:
 * - ANTHROPIC_API_KEY for Claude models
 * - OPENAI_API_KEY for OpenAI models
 * - Other provider keys via cline auth command
 */
async function clineSetup(
  sandbox: CodeAgentSandbox,
  env: Record<string, string>
): Promise<void> {
  if (!sandbox.executeCommand) return

  // Cline can use environment variables for authentication
  // The auth command can be used for manual setup, but we'll rely on env vars
  // for automated headless operation

  // If ANTHROPIC_API_KEY is provided, configure for Anthropic
  if (env.ANTHROPIC_API_KEY) {
    const safeKey = env.ANTHROPIC_API_KEY.replace(/'/g, "'\\''")
    await sandbox.executeCommand(
      `cline auth -p anthropic -k '${safeKey}' 2>&1 || true`,
      30
    )
  }

  // If OPENAI_API_KEY is provided, configure for OpenAI
  if (env.OPENAI_API_KEY) {
    const safeKey = env.OPENAI_API_KEY.replace(/'/g, "'\\''")
    await sandbox.executeCommand(
      `cline auth -p openai-native -k '${safeKey}' 2>&1 || true`,
      30
    )
  }
}

/**
 * Cline CLI agent definition.
 *
 * Interacts with the Cline CLI tool which outputs JSON lines
 * when run with the --json flag.
 */
export const clineAgent: AgentDefinition = {
  name: "cline",

  toolMappings: CLINE_TOOL_MAPPINGS,

  capabilities: {
    supportsSystemPrompt: false,
    supportsResume: false, // Session resume TBD based on CLI capabilities
    setup: clineSetup,
  },

  buildCommand(options: RunOptions): CommandSpec {
    const args: string[] = []

    // Auto-approve all actions for headless/autonomous operation
    // -y / --yolo flag enables autonomous execution
    args.push("-y")

    // JSON output for streaming events
    args.push("--json")

    // Add model if specified
    // Cline supports -m / --modelid for model selection
    if (options.model) {
      args.push("-m", options.model)
    }

    // Add provider if specified in env
    // Provider can be specified via -p flag
    if (options.env?.CLINE_PROVIDER) {
      args.push("-p", options.env.CLINE_PROVIDER)
    }

    // Add timeout if specified
    if (options.timeout) {
      args.push("--timeout", String(options.timeout))
    }

    // Add prompt as trailing argument
    if (options.prompt) {
      args.push(options.prompt)
    }

    return {
      cmd: "cline",
      args,
      env: options.env,
    }
  },

  parse(line: string, context: ParseContext): Event | Event[] | null {
    return parseClineLine(line, this.toolMappings, context)
  },
}
