/**
 * Repo State Store using Zustand
 *
 * Manages repository and branch state that needs to persist across navigation.
 * This solves the issue of chat messages being lost when navigating away from
 * the home page (e.g., to /admin or /team) and back.
 *
 * Previously this state was in useState within useRepoData hook, which was
 * destroyed on component unmount.
 */

import { create } from "zustand"
import { devtools } from "zustand/middleware"
import type { TransformedRepo } from "@/lib/db/db-types"

interface RepoState {
  // Repository data with branches and messages
  repos: TransformedRepo[]
  // Whether initial data has been loaded from the server
  loaded: boolean
  // Branch IDs that are currently loading messages
  loadingMessageBranchIds: Set<string>
}

interface RepoActions {
  setRepos: (repos: TransformedRepo[] | ((prev: TransformedRepo[]) => TransformedRepo[])) => void
  setLoaded: (loaded: boolean) => void
  setLoadingMessageBranchIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  // Reset state (used on logout)
  resetRepoState: () => void
}

const initialState: RepoState = {
  repos: [],
  loaded: false,
  loadingMessageBranchIds: new Set(),
}

const storeCreator = (
  set: (partial: Partial<RepoState> | ((state: RepoState) => Partial<RepoState>)) => void,
  get: () => RepoState & RepoActions
) => ({
  ...initialState,

  setRepos: (repos: TransformedRepo[] | ((prev: TransformedRepo[]) => TransformedRepo[])) => {
    if (typeof repos === "function") {
      set((state) => ({ repos: repos(state.repos) }))
    } else {
      set({ repos })
    }
  },

  setLoaded: (loaded: boolean) => set({ loaded }),

  setLoadingMessageBranchIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (typeof ids === "function") {
      set((state) => ({ loadingMessageBranchIds: ids(state.loadingMessageBranchIds) }))
    } else {
      set({ loadingMessageBranchIds: ids })
    }
  },

  resetRepoState: () => set(initialState),
})

// Only use devtools in development
export const useRepoStore =
  process.env.NODE_ENV === "development"
    ? create<RepoState & RepoActions>()(devtools(storeCreator, { name: "repo-store" }))
    : create<RepoState & RepoActions>()(storeCreator)
