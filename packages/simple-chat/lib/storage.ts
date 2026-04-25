/**
 * Storage utilities for Simple Chat
 *
 * This file contains minimal shared utilities:
 * - DEFAULT_SETTINGS: Used as fallback when settings not loaded
 * - clearAllStorage(): Called on sign-out to clear all local data
 * - collectDescendantIds(): Used for cascade delete of chat trees
 *
 * State management has been migrated to:
 * - Server state → TanStack Query (lib/queries/)
 * - UI state → Zustand ui-store (lib/stores/ui-store.ts)
 * - Stream state → Zustand stream-store (lib/stores/stream-store.ts)
 */

import type { Chat, Settings } from "./types"

// =============================================================================
// Defaults
// =============================================================================

export const DEFAULT_SETTINGS: Settings = {
  defaultAgent: "opencode",
  defaultModel: "opencode/big-pickle",
  theme: "system",
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Clear all local storage - called on sign out
 */
export function clearAllStorage(): void {
  if (typeof window === "undefined") return
  try {
    // Legacy keys (can be removed after migration is complete)
    localStorage.removeItem("simple-chat-local")
    localStorage.removeItem("simple-chat-cache")
    localStorage.removeItem("simple-chat-unseen-completions")
    // New Zustand keys
    localStorage.removeItem("simple-chat-ui")
  } catch (error) {
    console.error("Failed to clear storage:", error)
  }
}

/**
 * Collect all descendant chat IDs for a root chat (for cascade delete)
 */
export function collectDescendantIds(
  chats: Array<{ id: string; parentChatId?: string | null }>,
  rootId: string
): string[] {
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
