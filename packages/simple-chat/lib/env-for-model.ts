/**
 * Credential handling for Simple Chat
 *
 * Determines which API keys to inject based on agent type and selected model.
 * Builds a fresh, minimal env object on each call - no accumulation.
 */

import type { Agent } from "@upstream/common"

export interface Credentials {
  anthropicApiKey?: string
  anthropicAuthToken?: string
  openaiApiKey?: string
  opencodeApiKey?: string
  geminiApiKey?: string
}

/**
 * Determines which API key(s) to inject based on agent type and selected model.
 * Returns a fresh environment variables object appropriate for the model provider.
 *
 * Key behavior:
 * - For claude-code: subscription token (anthropicAuthToken) takes precedence over API key
 * - Each agent type gets only the credentials it needs
 * - Returns empty object if no credentials are needed/available
 */
export function getEnvForModel(
  model: string | undefined,
  agent: Agent | undefined,
  credentials: Credentials
): Record<string, string> {
  const env: Record<string, string> = {}

  // For Claude Code agent: use API key only if not using auth token (credentials file)
  // Auth token (subscription) takes precedence
  if (agent === "claude-code" || !agent) {
    if (credentials.anthropicAuthToken) {
      env.CLAUDE_CODE_CREDENTIALS = credentials.anthropicAuthToken
    } else if (credentials.anthropicApiKey) {
      env.ANTHROPIC_API_KEY = credentials.anthropicApiKey
    }
    return env
  }

  // For Codex agent: use OpenAI API key
  if (agent === "codex") {
    if (credentials.openaiApiKey) {
      env.OPENAI_API_KEY = credentials.openaiApiKey
    }
    return env
  }

  // For Gemini agent: use Gemini API key
  if (agent === "gemini") {
    if (credentials.geminiApiKey) {
      env.GEMINI_API_KEY = credentials.geminiApiKey
      env.GOOGLE_API_KEY = credentials.geminiApiKey // Also set GOOGLE_API_KEY for compatibility
    }
    return env
  }

  // For Goose agent: determine API key based on model
  // Goose uses either OpenAI or Anthropic depending on the model
  if (agent === "goose") {
    if (model?.includes("claude")) {
      if (credentials.anthropicApiKey) {
        env.ANTHROPIC_API_KEY = credentials.anthropicApiKey
      }
    } else {
      // Default to OpenAI for GPT models and others
      if (credentials.openaiApiKey) {
        env.OPENAI_API_KEY = credentials.openaiApiKey
      }
    }
    return env
  }

  // For Pi agent: determine API key based on model prefix
  // Pi supports multiple providers (Anthropic, OpenAI, Google) via model prefix
  if (agent === "pi") {
    const modelPrefix = model?.split("/")[0]

    if (modelPrefix === "openai") {
      if (credentials.openaiApiKey) {
        env.OPENAI_API_KEY = credentials.openaiApiKey
      }
    } else if (modelPrefix === "google") {
      if (credentials.geminiApiKey) {
        env.GEMINI_API_KEY = credentials.geminiApiKey
      }
    } else {
      // Default: Anthropic models (sonnet, opus, haiku)
      if (credentials.anthropicApiKey) {
        env.ANTHROPIC_API_KEY = credentials.anthropicApiKey
      }
    }
    return env
  }

  // For ELIZA agent: no API keys needed (uses local LLM or configured externally)
  if (agent === "eliza") {
    return env
  }

  // For OpenCode agent: determine API key based on model prefix
  if (agent === "opencode") {
    const modelPrefix = model?.split("/")[0]

    if (modelPrefix === "anthropic") {
      if (credentials.anthropicApiKey) {
        env.ANTHROPIC_API_KEY = credentials.anthropicApiKey
      }
    } else if (modelPrefix === "openai") {
      if (credentials.openaiApiKey) {
        env.OPENAI_API_KEY = credentials.openaiApiKey
      }
    } else if (modelPrefix === "opencode") {
      // opencode/* models - free ones don't need a key, paid ones use OpenCode API key
      const isFreeModel = model?.includes("-free") || model === "opencode/big-pickle"
      if (!isFreeModel && credentials.opencodeApiKey) {
        env.OPENCODE_API_KEY = credentials.opencodeApiKey
      }
    }
    return env
  }

  return env
}
