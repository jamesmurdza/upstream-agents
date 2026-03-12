/**
 * Agent Provider Configuration
 *
 * Defines the supported AI coding agents and their configurations.
 * Used throughout the app for provider selection, credential validation,
 * and model options.
 */

export type AgentProvider = "claude" | "codex" | "opencode"

export interface ProviderConfig {
  name: AgentProvider
  displayName: string
  description: string
  defaultModel: string
  models: string[]
}

/**
 * Configuration for each supported provider
 */
export const PROVIDERS: Record<AgentProvider, ProviderConfig> = {
  claude: {
    name: "claude",
    displayName: "Claude",
    description: "Anthropic's Claude Code",
    defaultModel: "sonnet",
    models: ["sonnet", "opus", "haiku"],
  },
  codex: {
    name: "codex",
    displayName: "Codex",
    description: "OpenAI's coding agent",
    defaultModel: "gpt-4o",
    models: ["gpt-4o", "o1", "o3", "o4-mini"],
  },
  opencode: {
    name: "opencode",
    displayName: "OpenCode",
    description: "Open source, multi-provider",
    defaultModel: "anthropic:claude-sonnet-4-20250514",
    models: [
      // Anthropic models
      "anthropic:claude-sonnet-4-20250514",
      "anthropic:claude-opus-4-20250514",
      // OpenAI models
      "openai:gpt-4o",
      "openai:o1",
      "openai:o3",
      // Groq free models
      "groq:llama-3.3-70b-versatile",
      "groq:llama-3.1-8b-instant",
      // OpenRouter models
      "openrouter:anthropic/claude-3.5-sonnet",
      "openrouter:google/gemini-2.0-flash-exp:free",
      "openrouter:meta-llama/llama-3.3-70b-instruct:free",
    ],
  },
}

/**
 * Check if user has the required credentials for a provider
 */
export function hasCredentialsForProvider(
  provider: AgentProvider,
  credentials: {
    hasAnthropicApiKey?: boolean
    hasAnthropicAuthToken?: boolean // Claude Max subscription
    hasOpenaiApiKey?: boolean
  }
): boolean {
  switch (provider) {
    case "claude":
      // Claude supports both API key and Max subscription
      return !!credentials.hasAnthropicApiKey || !!credentials.hasAnthropicAuthToken
    case "codex":
      return !!credentials.hasOpenaiApiKey
    case "opencode":
      // OpenCode can work with OpenAI, Anthropic, or free models (Groq, OpenRouter free)
      // For free models, no credentials needed but we'll require at least one for now
      return !!credentials.hasOpenaiApiKey || !!credentials.hasAnthropicApiKey
  }
}

/**
 * Get the environment variables needed for a provider
 */
export function getEnvVarsForProvider(
  provider: AgentProvider,
  credentials: {
    anthropicApiKey?: string
    anthropicAuthToken?: string // Claude Max subscription token
    openaiApiKey?: string
  }
): Record<string, string> {
  const envVars: Record<string, string> = {}

  switch (provider) {
    case "claude":
      // Claude supports API key or Max subscription token
      if (credentials.anthropicApiKey) {
        envVars.ANTHROPIC_API_KEY = credentials.anthropicApiKey
      }
      if (credentials.anthropicAuthToken) {
        // Claude Max uses CLAUDE_CODE_USE_BEDROCK=0 and a session token
        envVars.CLAUDE_AUTH_TOKEN = credentials.anthropicAuthToken
      }
      return envVars

    case "codex":
      if (credentials.openaiApiKey) {
        envVars.OPENAI_API_KEY = credentials.openaiApiKey
      }
      return envVars

    case "opencode":
      // OpenCode can use multiple providers - pass all available credentials
      if (credentials.openaiApiKey) {
        envVars.OPENAI_API_KEY = credentials.openaiApiKey
      }
      if (credentials.anthropicApiKey) {
        envVars.ANTHROPIC_API_KEY = credentials.anthropicApiKey
      }
      // OpenRouter uses OPENROUTER_API_KEY but we can use OpenAI key format
      // Groq uses GROQ_API_KEY - free tier available
      return envVars
  }
}

/**
 * Labels for displaying agent names (for backward compatibility with existing agentLabels)
 */
export const agentLabels: Record<string, string> = {
  "claude-code": "Claude Code",
  claude: "Claude",
  codex: "Codex",
  opencode: "OpenCode",
}
