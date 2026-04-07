/**
 * Zustand Stores
 *
 * This module exports all Zustand stores for the application.
 * Use these stores for client-side state that doesn't come from the server.
 *
 * For server state (data from APIs), use TanStack Query instead.
 * See: lib/api/index.ts
 */

// UI Store - modal states, sidebar, loading states
export { useUIStore } from "./ui-store"

// Selection Store - active repo/branch selection
export { useSelectionStore } from "./selection-store"

// Repo Store - repos, branches, and messages (persists across navigation)
export { useRepoStore } from "./repo-store"
