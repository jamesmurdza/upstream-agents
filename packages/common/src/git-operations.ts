/**
 * Git operation types and utilities
 * Shared between web and simple-chat packages
 */

// =============================================================================
// Types
// =============================================================================

/**
 * State representing an in-progress rebase or merge with conflicts
 */
export interface RebaseConflictState {
  inRebase: boolean
  inMerge: boolean
  conflictedFiles: string[]
}

/**
 * Result of checking rebase/merge status
 */
export interface GitStatusResult {
  inRebase: boolean
  inMerge: boolean
  conflictedFiles: string[]
}

/**
 * Result of a merge operation
 */
export interface MergeResult {
  success: boolean
  conflict?: boolean
  inMerge?: boolean
  conflictedFiles?: string[]
  targetBranch?: string
  currentBranch?: string
  message?: string
  error?: string
}

/**
 * Result of a rebase operation
 */
export interface RebaseResult {
  success: boolean
  conflict?: boolean
  conflictedFiles?: string[]
  targetBranch?: string
  message?: string
  error?: string
}

/**
 * Options for git operations that need sandbox access
 */
export interface GitOperationContext {
  sandboxId: string
  repoPath: string
  repoOwner: string
  repoApiName: string
  githubToken: string
}

// =============================================================================
// PR Generation Utilities
// =============================================================================

/**
 * Generate a simple PR title from a branch name
 * Converts branch names like "feat/add-dark-mode" to "Add dark mode"
 */
export function formatPRTitleFromBranch(branchName: string): string {
  return branchName
    .replace(/^(feat|fix|refactor|docs|test|chore)\//, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
}

/**
 * Generate a simple PR body from commit messages
 */
export function formatPRBodyFromCommits(commits: string[]): string {
  if (commits.length === 0) {
    return "Automated PR"
  }
  return commits.map((c) => `- ${c}`).join("\n")
}

// =============================================================================
// Authenticated Git Fetch Helpers
// =============================================================================

/**
 * Interface for sandbox process execution (compatible with Daytona SDK)
 */
export interface SandboxProcessExecutor {
  executeCommand(command: string): Promise<{ result: string; exitCode: number }>
}

/**
 * Helper to create an authenticated GitHub URL for git operations
 */
export function createAuthenticatedUrl(originalUrl: string, githubToken: string): string {
  return originalUrl.replace(/^https:\/\//, `https://x-access-token:${githubToken}@`)
}

/**
 * Fetch a specific branch from remote with authentication.
 * Temporarily sets authenticated URL, fetches, then restores original URL.
 *
 * This is important for single-branch clones where the target branch
 * might not exist locally or might be outdated.
 *
 * @param executor - Sandbox process executor (sandbox.process)
 * @param repoPath - Path to the repository
 * @param githubToken - GitHub access token
 * @param branchName - Branch to fetch (or "--prune" for all branches)
 */
export async function fetchBranchWithAuth(
  executor: SandboxProcessExecutor,
  repoPath: string,
  githubToken: string,
  branchName: string
): Promise<void> {
  const origUrlResult = await executor.executeCommand(
    `cd ${repoPath} && git remote get-url origin 2>&1`
  )
  const origUrl = origUrlResult.result.trim()
  const authedUrl = createAuthenticatedUrl(origUrl, githubToken)

  await executor.executeCommand(
    `cd ${repoPath} && git remote set-url origin '${authedUrl}' 2>&1`
  )
  // For single-branch clones, we need to explicitly create the remote tracking ref
  // Using refspec format: fetch branchName and create refs/remotes/origin/branchName
  // For --prune or other flags, use them directly
  const fetchCmd = branchName.startsWith("-")
    ? `cd ${repoPath} && git fetch origin ${branchName} 2>&1`
    : `cd ${repoPath} && git fetch origin ${branchName}:refs/remotes/origin/${branchName} 2>&1`
  await executor.executeCommand(fetchCmd)
  // Restore original URL
  await executor.executeCommand(
    `cd ${repoPath} && git remote set-url origin '${origUrl}' 2>&1`
  )
}

// =============================================================================
// Git Command Helpers
// =============================================================================

/**
 * Check if a git message indicates nothing to commit
 */
export function isGitNothingToCommitMessage(message: string): boolean {
  const lowerMessage = message.toLowerCase()
  return (
    lowerMessage.includes("nothing to commit") ||
    lowerMessage.includes("no changes added to commit") ||
    lowerMessage.includes("working tree clean")
  )
}

/**
 * Parse conflicted files from git diff output
 */
export function parseConflictedFiles(diffOutput: string): string[] {
  return diffOutput
    .trim()
    .split("\n")
    .filter(Boolean)
}

/**
 * Default empty conflict state
 */
export const EMPTY_CONFLICT_STATE: RebaseConflictState = {
  inRebase: false,
  inMerge: false,
  conflictedFiles: [],
}
