/**
 * Stream Store - Per-chat SSE stream state management
 *
 * This store isolates each chat's streaming state in a Map, preventing
 * race conditions from shared refs. Each chat owns its own:
 * - EventSource connection
 * - Cursor position for reconnection
 * - Accumulated content (text, tool calls, content blocks)
 *
 * Event handlers read fresh state via getState() instead of closures,
 * eliminating stale closure bugs when switching between chats.
 */

import { create } from "zustand"
import type { Message } from "@/lib/types"

// =============================================================================
// Types
// =============================================================================

export interface StreamState {
  /** The SSE EventSource connection */
  eventSource: EventSource | null
  /** Cursor position for reconnection */
  cursor: number
  /** Number of reconnection attempts */
  reconnectAttempts: number
  /** Accumulated content for the current streaming response */
  accumulated: {
    content: string
    toolCalls: Message["toolCalls"]
    contentBlocks: Message["contentBlocks"]
  }
  /** Connection parameters for reconnection */
  connectionParams: {
    sandboxId: string
    repoName: string
    backgroundSessionId: string
    previewUrlPattern?: string
  } | null
}

interface StreamStore {
  // =============================================================================
  // State
  // =============================================================================

  /** Map of chatId -> stream state */
  streams: Map<string, StreamState>

  /** Set of chatIds that recently completed streaming (prevents server overwrites) */
  recentlyCompletedChats: Set<string>

  // =============================================================================
  // Actions
  // =============================================================================

  /** Initialize a new stream for a chat */
  startStream: (
    chatId: string,
    params: NonNullable<StreamState["connectionParams"]>
  ) => void

  /** Stop and clean up a stream */
  stopStream: (chatId: string) => void

  /** Mark a chat as recently completed (call this BEFORE stopStream) */
  markCompleted: (chatId: string) => void

  /** Check if a chat recently completed streaming */
  isRecentlyCompleted: (chatId: string) => boolean

  /** Update stream state */
  updateStream: (chatId: string, updates: Partial<StreamState>) => void

  /** Get stream state for a chat */
  getStream: (chatId: string) => StreamState | undefined

  /** Check if a chat is currently streaming */
  isStreaming: (chatId: string) => boolean

  /** Check if a chat is streaming OR recently completed */
  isStreamingOrRecentlyCompleted: (chatId: string) => boolean

  // =============================================================================
  // Accumulator Helpers
  // =============================================================================

  /** Append content to accumulated text */
  appendContent: (chatId: string, content: string) => void

  /** Append tool calls to accumulated list */
  appendToolCalls: (chatId: string, toolCalls: Message["toolCalls"]) => void

  /** Append content blocks to accumulated list */
  appendContentBlocks: (
    chatId: string,
    blocks: Message["contentBlocks"]
  ) => void

  /** Reset accumulated content (for new streaming session) */
  resetAccumulated: (chatId: string) => void

  /** Get accumulated content for a chat */
  getAccumulated: (chatId: string) => StreamState["accumulated"] | null
}

// =============================================================================
// Helpers
// =============================================================================

const createEmptyStreamState = (): StreamState => ({
  eventSource: null,
  cursor: 0,
  reconnectAttempts: 0,
  accumulated: { content: "", toolCalls: [], contentBlocks: [] },
  connectionParams: null,
})

// =============================================================================
// Store
// =============================================================================

// How long to keep a chat marked as "recently completed" (prevents server overwrites)
const RECENTLY_COMPLETED_TTL = 5000 // 5 seconds

export const useStreamStore = create<StreamStore>((set, get) => ({
  streams: new Map(),
  recentlyCompletedChats: new Set(),

  startStream: (chatId, params) => {
    // Close existing stream if any
    const existing = get().streams.get(chatId)
    if (existing?.eventSource) {
      existing.eventSource.close()
    }

    // Remove from recently completed if starting a new stream
    set((state) => {
      const streams = new Map(state.streams)
      const recentlyCompletedChats = new Set(state.recentlyCompletedChats)
      recentlyCompletedChats.delete(chatId)
      streams.set(chatId, {
        ...createEmptyStreamState(),
        connectionParams: params,
      })
      return { streams, recentlyCompletedChats }
    })
  },

  stopStream: (chatId) => {
    const stream = get().streams.get(chatId)
    if (stream?.eventSource) {
      stream.eventSource.close()
    }
    set((state) => {
      const streams = new Map(state.streams)
      streams.delete(chatId)
      return { streams }
    })
  },

  markCompleted: (chatId) => {
    set((state) => {
      const recentlyCompletedChats = new Set(state.recentlyCompletedChats)
      recentlyCompletedChats.add(chatId)
      return { recentlyCompletedChats }
    })

    // Auto-remove after TTL
    setTimeout(() => {
      set((state) => {
        const recentlyCompletedChats = new Set(state.recentlyCompletedChats)
        recentlyCompletedChats.delete(chatId)
        return { recentlyCompletedChats }
      })
    }, RECENTLY_COMPLETED_TTL)
  },

  isRecentlyCompleted: (chatId) => get().recentlyCompletedChats.has(chatId),

  isStreamingOrRecentlyCompleted: (chatId) =>
    get().streams.has(chatId) || get().recentlyCompletedChats.has(chatId),

  updateStream: (chatId, updates) => {
    set((state) => {
      const existing = state.streams.get(chatId)
      if (!existing) return state
      const streams = new Map(state.streams)
      streams.set(chatId, { ...existing, ...updates })
      return { streams }
    })
  },

  getStream: (chatId) => get().streams.get(chatId),

  isStreaming: (chatId) => get().streams.has(chatId),

  appendContent: (chatId, content) => {
    if (!content) return
    set((state) => {
      const existing = state.streams.get(chatId)
      if (!existing) return state
      const streams = new Map(state.streams)
      streams.set(chatId, {
        ...existing,
        accumulated: {
          ...existing.accumulated,
          content: existing.accumulated.content + content,
        },
      })
      return { streams }
    })
  },

  appendToolCalls: (chatId, toolCalls) => {
    if (!toolCalls?.length) return
    set((state) => {
      const existing = state.streams.get(chatId)
      if (!existing) return state
      const streams = new Map(state.streams)
      streams.set(chatId, {
        ...existing,
        accumulated: {
          ...existing.accumulated,
          toolCalls: [...(existing.accumulated.toolCalls || []), ...toolCalls],
        },
      })
      return { streams }
    })
  },

  appendContentBlocks: (chatId, blocks) => {
    if (!blocks?.length) return
    set((state) => {
      const existing = state.streams.get(chatId)
      if (!existing) return state
      const streams = new Map(state.streams)
      streams.set(chatId, {
        ...existing,
        accumulated: {
          ...existing.accumulated,
          contentBlocks: [
            ...(existing.accumulated.contentBlocks || []),
            ...blocks,
          ],
        },
      })
      return { streams }
    })
  },

  resetAccumulated: (chatId) => {
    set((state) => {
      const existing = state.streams.get(chatId)
      if (!existing) return state
      const streams = new Map(state.streams)
      streams.set(chatId, {
        ...existing,
        accumulated: { content: "", toolCalls: [], contentBlocks: [] },
      })
      return { streams }
    })
  },

  getAccumulated: (chatId) => get().streams.get(chatId)?.accumulated ?? null,
}))
