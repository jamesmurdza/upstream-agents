/**
 * TanStack Query Key Factory
 *
 * Centralized, typed query keys for consistent cache management.
 * All query keys should be defined here to ensure consistency
 * across queries, mutations, and cache invalidation.
 */

export const chatKeys = {
  /** All chats list */
  all: ["chats"] as const,
  /** Single chat with messages */
  detail: (id: string) => ["chats", id] as const,
} as const

export const settingsKeys = {
  /** User settings and credential flags */
  all: ["settings"] as const,
} as const
