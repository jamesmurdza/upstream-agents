/**
 * LocalStorage utilities for Simple Chat
 *
 * Only device-specific state is stored here:
 * - currentChatId, previewItems, queuedMessages, queuePaused, drafts
 * - unseenChatIds
 *
 * Server data (chats, messages, settings) is managed by TanStack Query.
 */

import type { Chat, Settings } from "./types"

// =============================================================================
// Storage Keys
// =============================================================================

const LOCAL_STATE_KEY = "simple-chat-local"
const UNSEEN_KEY = "simple-chat-unseen-completions"

// =============================================================================
// Types
// =============================================================================

/**
 * Device-specific state that stays in localStorage (NOT synced to server)
 */
export interface LocalState {
  currentChatId: string | null
  previewItems: Record<string, Chat["previewItem"]>
  queuedMessages: Record<string, Chat["queuedMessages"]>
  queuePaused: Record<string, boolean>
  drafts: Record<string, string>
}

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_SETTINGS: Settings = {
  defaultAgent: null,
  defaultModel: null,
  theme: "system",
}

const DEFAULT_LOCAL_STATE: LocalState = {
  currentChatId: null,
  previewItems: {},
  queuedMessages: {},
  queuePaused: {},
  drafts: {},
}

// =============================================================================
// Local State (Device-Specific)
// =============================================================================

export function loadLocalState(): LocalState {
  if (typeof window === "undefined") {
    return DEFAULT_LOCAL_STATE
  }

  try {
    const stored = localStorage.getItem(LOCAL_STATE_KEY)
    if (!stored) {
      return DEFAULT_LOCAL_STATE
    }
    const parsed = JSON.parse(stored) as LocalState
    return {
      ...DEFAULT_LOCAL_STATE,
      ...parsed,
    }
  } catch (error) {
    console.error("Failed to load local state:", error)
    return DEFAULT_LOCAL_STATE
  }
}

export function saveLocalState(state: LocalState): void {
  if (typeof window === "undefined") {
    return
  }

  try {
    localStorage.setItem(LOCAL_STATE_KEY, JSON.stringify(state))
  } catch (error) {
    console.error("Failed to save local state:", error)
  }
}

export function setCurrentChatId(chatId: string | null): void {
  const state = loadLocalState()
  saveLocalState({ ...state, currentChatId: chatId })
}

export function setPreviewItem(chatId: string, item: Chat["previewItem"]): void {
  const state = loadLocalState()
  saveLocalState({
    ...state,
    previewItems: { ...state.previewItems, [chatId]: item },
  })
}

export function setQueuedMessages(chatId: string, messages: Chat["queuedMessages"]): void {
  const state = loadLocalState()
  saveLocalState({
    ...state,
    queuedMessages: { ...state.queuedMessages, [chatId]: messages },
  })
}

export function setQueuePaused(chatId: string, paused: boolean): void {
  const state = loadLocalState()
  saveLocalState({
    ...state,
    queuePaused: { ...state.queuePaused, [chatId]: paused },
  })
}

export function setDraft(chatId: string, draft: string | undefined): void {
  const state = loadLocalState()
  const newDrafts = { ...state.drafts }
  if (draft === undefined || draft === "") {
    delete newDrafts[chatId]
  } else {
    newDrafts[chatId] = draft
  }
  saveLocalState({
    ...state,
    drafts: newDrafts,
  })
}

export function clearLocalStateForChats(chatIds: string[]): void {
  const localState = loadLocalState()
  const newPreviewItems = { ...localState.previewItems }
  const newQueuedMessages = { ...localState.queuedMessages }
  const newQueuePaused = { ...localState.queuePaused }
  const newDrafts = { ...localState.drafts }

  for (const id of chatIds) {
    delete newPreviewItems[id]
    delete newQueuedMessages[id]
    delete newQueuePaused[id]
    delete newDrafts[id]
  }

  saveLocalState({
    ...localState,
    previewItems: newPreviewItems,
    queuedMessages: newQueuedMessages,
    queuePaused: newQueuePaused,
    drafts: newDrafts,
    currentChatId: chatIds.includes(localState.currentChatId ?? "")
      ? null
      : localState.currentChatId,
  })
}

// =============================================================================
// Unseen Chat IDs (Device-Specific)
// =============================================================================

export function loadUnseenChatIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const stored = localStorage.getItem(UNSEEN_KEY)
    if (!stored) return new Set()
    const parsed = JSON.parse(stored) as string[]
    return new Set(parsed)
  } catch {
    return new Set()
  }
}

export function saveUnseenChatIds(ids: Set<string>): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(UNSEEN_KEY, JSON.stringify([...ids]))
  } catch (error) {
    console.error("Failed to save unseen chat ids:", error)
  }
}

// =============================================================================
// Utilities
// =============================================================================

export function clearAllStorage(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(LOCAL_STATE_KEY)
    localStorage.removeItem(UNSEEN_KEY)
    // Also clear legacy server cache key if it exists
    localStorage.removeItem("simple-chat-cache")
  } catch (error) {
    console.error("Failed to clear storage:", error)
  }
}

export function collectDescendantIds(chats: Chat[], rootId: string): string[] {
  const ids = new Set<string>([rootId])
  let changed = true
  while (changed) {
    changed = false
    for (const chat of chats) {
      if (chat.parentChatId && ids.has(chat.parentChatId) && !ids.has(chat.id)) {
        ids.add(chat.id)
        changed = true
      }
    }
  }
  return Array.from(ids)
}
