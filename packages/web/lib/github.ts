/**
 * GitHub API client for Simple Chat
 *
 * All functions call server-side proxy routes — the GitHub token never
 * leaves the server. The proxy routes fetch the token from the DB.
 */

import type {
  GitHubUser,
  GitHubRepo,
  GitHubBranch,
} from "@upstream/common"

// Re-export types for convenience
export type { GitHubUser, GitHubRepo, GitHubBranch }

/**
 * Fetch repositories for the authenticated user (100 most recent).
 * Calls GET /api/github/repos which reads the token from DB server-side.
 */
export async function fetchRepos(): Promise<GitHubRepo[]> {
  const res = await fetch("/api/github/repos")
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || "Failed to fetch repos")
  }
  const data = await res.json()
  return data.repos
}

/**
 * Fetch a single repository.
 * Calls GET /api/github/repo which reads the token from DB server-side.
 */
export async function fetchRepo(
  owner: string,
  repo: string
): Promise<GitHubRepo> {
  const res = await fetch(`/api/github/repo?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || "Failed to fetch repo")
  }
  const data = await res.json()
  return data.repo
}

/**
 * Fetch branches for a repository.
 * Calls GET /api/github/branches which reads the token from DB server-side.
 */
export async function fetchBranches(
  owner: string,
  repo: string
): Promise<GitHubBranch[]> {
  const res = await fetch(`/api/github/branches?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || "Failed to fetch branches")
  }
  const data = await res.json()
  return data.branches
}

/**
 * Push commits to remote (simple-chat specific - calls local API)
 */
export async function pushToRemote(
  sandboxId: string,
  repoName: string,
  branch: string
): Promise<void> {
  const response = await fetch("/api/git/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sandboxId, repoName, branch }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || "Failed to push to remote")
  }
}

/**
 * Create a new GitHub repository (simple-chat specific - calls local API)
 */
export async function createRepository(options: {
  name: string
  description?: string
  isPrivate?: boolean
}): Promise<GitHubRepo> {
  const response = await fetch("/api/github/create-repo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to create repository")
  }

  return response.json()
}
