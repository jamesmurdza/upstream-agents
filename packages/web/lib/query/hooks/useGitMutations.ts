"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "../keys"

// ============================================================================
// Git Push
// ============================================================================

interface GitPushParams {
  sandboxId: string
  repoName: string
  branch: string
}

/**
 * Pushes changes to GitHub.
 * Retries automatically on transient failures.
 */
export function useGitPushMutation() {
  return useMutation({
    mutationFn: async ({ sandboxId, repoName, branch }: GitPushParams) => {
      const res = await fetch("/api/git/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId, repoName, branch }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || `Push failed with status ${res.status}`)
      }

      return res.json()
    },
    retry: 2,
    retryDelay: 1000,
  })
}

// ============================================================================
// Git Merge
// ============================================================================

interface GitMergeParams {
  sandboxId: string
  targetBranch: string
  repoFullName: string
  currentBranch: string
}

export function useGitMergeMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: GitMergeParams) => {
      const res = await fetch("/api/sandbox/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, action: "merge" }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || "Merge failed")
      }

      return res.json()
    },
    onSuccess: (_, params) => {
      // Invalidate branch comparisons after merge
      const [owner, repo] = params.repoFullName.split("/")
      if (owner && repo) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.github.branches(owner, repo),
        })
      }
    },
  })
}

// ============================================================================
// Git Rebase
// ============================================================================

interface GitRebaseParams {
  sandboxId: string
  targetBranch: string
  repoFullName: string
  currentBranch: string
}

export function useGitRebaseMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: GitRebaseParams) => {
      const res = await fetch("/api/sandbox/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, action: "rebase" }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || "Rebase failed")
      }

      return res.json()
    },
    onSuccess: (_, params) => {
      // Invalidate branch comparisons after rebase
      const [owner, repo] = params.repoFullName.split("/")
      if (owner && repo) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.github.branches(owner, repo),
        })
      }
    },
  })
}

// ============================================================================
// Abort Rebase
// ============================================================================

interface GitAbortParams {
  sandboxId: string
}

export function useGitAbortRebaseMutation() {
  return useMutation({
    mutationFn: async ({ sandboxId }: GitAbortParams) => {
      const res = await fetch("/api/sandbox/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId, action: "abort-rebase" }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || "Failed to abort rebase")
      }

      return res.json()
    },
  })
}

// ============================================================================
// Abort Merge
// ============================================================================

export function useGitAbortMergeMutation() {
  return useMutation({
    mutationFn: async ({ sandboxId }: GitAbortParams) => {
      const res = await fetch("/api/sandbox/git", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId, action: "abort-merge" }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || "Failed to abort merge")
      }

      return res.json()
    },
  })
}

// ============================================================================
// Create Pull Request
// ============================================================================

interface CreatePRParams {
  owner: string
  repo: string
  head: string
  base: string
  descriptionType?: "auto" | "none"
}

interface PRResult {
  url: string
  number: number
  title: string
}

export function useCreatePRMutation() {
  return useMutation({
    mutationFn: async (params: CreatePRParams): Promise<PRResult> => {
      const res = await fetch("/api/github/pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || "Failed to create PR")
      }

      return res.json()
    },
  })
}

// ============================================================================
// Setup Remote (for linking repo to existing sandbox)
// ============================================================================

interface SetupRemoteParams {
  sandboxId: string
  repoFullName: string
  branch: string
}

export function useSetupRemoteMutation() {
  return useMutation({
    mutationFn: async (params: SetupRemoteParams) => {
      const res = await fetch("/api/git/setup-remote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || "Failed to set up remote")
      }

      return res.json()
    },
  })
}
