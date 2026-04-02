/**
 * Coding Agents SDK
 *
 * A TypeScript SDK for interacting with various AI coding agents.
 * Create a sandbox with @daytonaio/sdk and pass it to createSession.
 *
 * @example
 * ```typescript
 * import { Daytona } from "@daytonaio/sdk"
 * import { createSession } from "@upstream/agents"
 *
 * const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY })
 * const sandbox = await daytona.create({ envVars: { ANTHROPIC_API_KEY: '...' } })
 *
 * const session = await createSession("claude", {
 *   sandbox,
 *   systemPrompt: 'You are a helpful assistant.',
 * })
 *
 * // Start a turn
 * await session.start("Hello!")
 *
 * // Poll for events
 * while (true) {
 *   const result = await session.getEvents()
 *   for (const event of result.events) {
 *     if (event.type === "token") process.stdout.write(event.text)
 *   }
 *   if (!result.running) break
 *   await new Promise(r => setTimeout(r, 500))
 * }
 *
 * await sandbox.delete()
 * ```
 */

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  Event,
  SessionEvent,
  TokenEvent,
  ToolStartEvent,
  ToolDeltaEvent,
  ToolEndEvent,
  EndEvent,
  AgentCrashedEvent,
  EventType,
  ToolName,
  WriteToolInput,
  ReadToolInput,
  EditToolInput,
  GlobToolInput,
  GrepToolInput,
  ShellToolInput,
  ToolInputMap,
} from "./types/events.js"

// ─────────────────────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  AgentDefinition,
  AgentCapabilities,
  CommandSpec,
  ParseContext,
  RunOptions,
} from "./core/agent.js"

export type { CanonicalToolName } from "./core/tools.js"

// ─────────────────────────────────────────────────────────────────────────────
// Background Session Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  BackgroundSession,
  BackgroundRunPhase,
  PollResult,
  TurnHandle,
} from "./background/index.js"

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  CodeAgentSandbox,
  ExecuteBackgroundOptions,
  AdaptSandboxOptions,
} from "./types/provider.js"

// ─────────────────────────────────────────────────────────────────────────────
// Session API (Main Entry Point)
// ─────────────────────────────────────────────────────────────────────────────

export {
  createSession,
  getSession,
  getAgentNames,
  // Legacy aliases
  createBackgroundSession,
  getBackgroundSession,
  type SessionOptions,
  type CreateSessionOptions,
} from "./session.js"

// ─────────────────────────────────────────────────────────────────────────────
// Agent Registry
// ─────────────────────────────────────────────────────────────────────────────

export { registry, getAgent } from "./core/registry.js"

// ─────────────────────────────────────────────────────────────────────────────
// Tool Utilities
// ─────────────────────────────────────────────────────────────────────────────

export {
  normalizeToolName,
  createToolStartEvent,
  getToolDisplayName,
  CANONICAL_DISPLAY_NAMES,
} from "./core/tools.js"

// ─────────────────────────────────────────────────────────────────────────────
// Agent Definitions (for direct import)
// ─────────────────────────────────────────────────────────────────────────────

export {
  claudeAgent,
  codexAgent,
  geminiAgent,
  opencodeAgent,
} from "./agents/index.js"

// ─────────────────────────────────────────────────────────────────────────────
// Sandbox Adapter
// ─────────────────────────────────────────────────────────────────────────────

export { adaptDaytonaSandbox, adaptSandbox } from "./sandbox/index.js"

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

export {
  safeJsonParse,
  isCliInstalled,
  installProvider,
  ensureCliInstalled,
  getPackageName,
  getInstallationStatus,
} from "./utils/index.js"

// Debug (enable with CODING_AGENTS_DEBUG=1)
export { isDebugEnabled, debugLog } from "./debug.js"

// ─────────────────────────────────────────────────────────────────────────────
// Legacy Exports (Deprecated - for backwards compatibility)
// ─────────────────────────────────────────────────────────────────────────────

// These are deprecated and will be removed in a future version.
// Use createSession() and getSession() instead.

/** @deprecated Use AgentDefinition instead */
export type { IProvider } from "./types/provider.js"

/** @deprecated Use createSession() instead */
export type {
  ProviderName,
  ProviderCommand,
  RunDefaults,
  ProviderOptions,
} from "./types/provider.js"

import { registry as _registry, getAgentNames as _getAgentNames } from "./core/registry.js"

/** @deprecated Use getAgentNames() instead */
export function getProviderNames(): string[] {
  return _getAgentNames()
}

/** @deprecated Use registry.has() instead */
export function isValidProvider(name: string): boolean {
  return _registry.has(name)
}

// Legacy provider exports (for backwards compatibility with tests)
// These will be removed in a future version.
/** @deprecated Use createSession() with agent name instead */
export {
  Provider,
  ClaudeProvider,
  CodexProvider,
  GeminiProvider,
  OpenCodeProvider,
} from "./providers/index.js"

/** @deprecated Use createSession() instead */
export { createProvider } from "./factory.js"
