/**
 * Background Session Types
 */

import type { Event } from "../types/events"

/**
 * Run phase for background sessions
 */
export type BackgroundRunPhase = "idle" | "starting" | "running" | "stopped"

/**
 * Handle returned when starting a turn
 */
export interface TurnHandle {
  executionId: string
  pid: number
  outputFile: string
}

/**
 * Result of polling for events
 */
export interface PollResult {
  sessionId: string | null
  events: Event[]
  cursor: string
  running: boolean
  runPhase: BackgroundRunPhase
}

/**
 * Session metadata stored in sandbox
 */
export interface SessionMeta {
  currentTurn: number
  cursor: number
  rawCursor?: number
  pid?: number
  runId?: string
  outputFile?: string
  sawEnd?: boolean
  startedAt?: string
  provider?: string
  sessionId?: string | null
}

/**
 * A single message from previous conversation history.
 * Used to inject context when switching agents or forking chats.
 */
export interface HistoryMessage {
  readonly role: "user" | "assistant"
  readonly content: string
}

/**
 * Options for starting a turn
 */
export interface StartOptions {
  prompt: string
  model?: string
  sessionId?: string
  timeout?: number
  systemPrompt?: string
  env?: Record<string, string>
  /** Working directory for the agent process */
  cwd?: string
  /** Previous conversation history to inject as context for this turn. */
  history?: readonly HistoryMessage[]
}
