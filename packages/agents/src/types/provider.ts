import type { Event } from "./events.js"

/**
 * Provider-related types and interfaces
 */

/** Supported provider names */
export type ProviderName = "claude" | "codex" | "opencode" | "gemini"

/** Options for starting a background command that writes to a log file and signals when done. */
export interface ExecuteBackgroundOptions {
  /** Full command line to run (stdout/stderr should be appended to outputFile). */
  command: string
  /** Path in sandbox to append output to (e.g. /tmp/codeagent-<id>/0.jsonl). */
  outputFile: string
  /** Unique run id (used for logging; PID is returned from executeBackground). */
  runId: string
  timeout?: number
}

/**
 * Sandbox interface required by the SDK. Implement this yourself or use
 * adaptDaytonaSandbox() to wrap a Daytona Sandbox from @daytonaio/sdk.
 */
export interface CodeAgentSandbox {
  ensureProvider(name: ProviderName): Promise<void>
  /** @deprecated Use setSessionEnvVars or setRunEnvVars instead for clearer precedence */
  setEnvVars(vars: Record<string, string>): void
  /** Set session-level env vars (medium precedence, persistent across runs) */
  setSessionEnvVars?(vars: Record<string, string>): void
  /** Set run-level env vars (highest precedence, cleared after each run) */
  setRunEnvVars?(vars: Record<string, string>): void
  /** Clear run-level env vars (called before each run to reset precedence) */
  clearRunEnvVars?(): void
  executeCommandStream(command: string, timeout?: number): AsyncGenerator<string, void, unknown>
  /** Optional: run a one-off command (used e.g. for Codex login). */
  executeCommand?(command: string, timeout?: number): Promise<{ exitCode: number; output: string }>
  /**
   * Optional: start a command in the background and return its pid immediately.
   * The sandbox must run the command with stdout/stderr >> outputFile and return
   * the pid (e.g. via nohup + SSH so the channel closes right away). Implement
   * this to avoid blocking on the command when using executeCommand.
   */
  executeBackground?(options: ExecuteBackgroundOptions): Promise<{ pid: number }>
  /** Kill a process by pid. */
  killBackgroundProcess?(pid: number, processName?: string): Promise<void>

  /** Optimized poll: reads meta, output, and done status in fewer commands. */
  pollBackgroundState?(sessionDir: string): Promise<{
    meta: string | null
    output: string
    done: boolean
  } | null>
}

/** Command configuration for spawning a provider process */
export interface ProviderCommand {
  cmd: string
  args: string[]
  env?: Record<string, string>
}

/** Options when adapting a Daytona sandbox for use with the SDK */
export interface AdaptSandboxOptions {
  /** Environment variables for CLI execution (e.g. ANTHROPIC_API_KEY) */
  env?: Record<string, string>
}

/** Options for running a provider */
export interface RunOptions {
  /** The prompt to send to the provider */
  prompt?: string
  /**
   * Optional system prompt / high-level instructions.
   * When set via createSession, providers that support system prompts will use
   * their native mechanism; others will have this string prepended to the first
   * user prompt in the session.
   */
  systemPrompt?: string
  /** Optional session ID to resume */
  sessionId?: string
  /** Working directory for the provider process */
  cwd?: string
  /** Environment variables to pass to the provider */
  env?: Record<string, string>
  /** Skip installing the CLI in the sandbox (default: false) */
  skipInstall?: boolean
  /** Timeout in seconds for sandbox execution (default: 120) */
  timeout?: number
  /** Model to use (provider-specific, e.g., "openai/gpt-4o") */
  model?: string
}

/** Default run options merged into every run (used by createSession) */
export type RunDefaults = Partial<Omit<RunOptions, "prompt">>

/** Options for creating a provider */
export interface ProviderOptions {
  /**
   * Sandbox for secure execution. Pass a Sandbox from @daytonaio/sdk directly
   * (the SDK adapts it internally). Optional env here is used for CLI execution.
   */
  sandbox: CodeAgentSandbox | import("@daytonaio/sdk").Sandbox

  /** Environment variables for CLI execution (e.g. when sandbox is a Daytona Sandbox) */
  env?: Record<string, string>

  /** Skip installing the provider CLI when the provider is created (default: false) */
  skipInstall?: boolean

  /** Defaults merged into every run() call (model, timeout, sessionId, env). Set by createSession. */
  runDefaults?: RunDefaults
}

/** Event handler callback */
export type EventHandler = (event: Event) => void | Promise<void>

/** Provider interface that all providers must implement */
export interface IProvider {
  /** Provider name */
  readonly name: ProviderName

  /** Current session ID */
  sessionId: string | null

  /** Convenience accessor for current session id */
  getSessionId(): string | null

  /** Get the command to spawn the provider */
  getCommand(options?: RunOptions): ProviderCommand

  /** Parse a line of output into one or more events */
  parse(line: string): Event | Event[] | null

  /** Resolves when CLI install and setup (env, Codex login) have completed. Await before first run if you want "ready" UX. */
  readonly ready: Promise<void>

  /** Run the provider and emit events. Pass a prompt string or full RunOptions. */
  run(promptOrOptions?: string | RunOptions): AsyncGenerator<Event, void, unknown>
}
