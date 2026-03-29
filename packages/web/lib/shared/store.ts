"use client"

/**
 * Generates a unique ID for client-side use (optimistic IDs for messages, branches, etc.)
 * These IDs are temporary and get replaced with database IDs after server response.
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
