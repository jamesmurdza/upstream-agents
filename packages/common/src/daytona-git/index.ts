/**
 * daytona-git: Drop-in replacement for Daytona SDK's sandbox.git
 *
 * Executes git commands directly via sandbox.process.executeCommand()
 * instead of relying on the Daytona Git Toolbox API.
 *
 * Key principle: Credentials are passed ephemerally per-operation
 * and never stored in the sandbox.
 *
 * @example
 * ```typescript
 * import { createSandboxGit } from "@upstream/common/daytona-git"
 *
 * const git = createSandboxGit(sandbox)
 *
 * await git.clone(url, path, branch, undefined, "x-access-token", token)
 * await git.createBranch(path, "feature/new-branch")
 * await git.checkoutBranch(path, "feature/new-branch")
 * await git.push(path, "x-access-token", token)
 * ```
 */

import type { SandboxLike, SandboxGit, GitStatus } from "./types"
import * as commands from "./commands"

// Re-export types
export type {
  SandboxGit,
  SandboxLike,
  SandboxProcess,
  GitStatus,
  FileStatus,
  FileStatusType,
  GitCommitResponse,
  ExecuteResult,
} from "./types"

// Re-export errors
export {
  GitError,
  GitAuthError,
  GitNotFoundError,
  GitConflictError,
  isAuthError,
  isNotFoundError,
  createGitError,
} from "./errors"

// Re-export auth utilities
export { createAuthUrl, stripCredentials, hasCredentials } from "./auth"

// Re-export parsers (useful for testing or custom implementations)
export {
  parseGitStatus,
  parseAheadBehind,
  parseCommitSha,
  parseBranchList,
} from "./parsers"

/**
 * Create a SandboxGit instance from a sandbox
 *
 * This is the main entry point. The returned object has the same API
 * as Daytona SDK's sandbox.git, making migration straightforward.
 *
 * @param sandbox - A sandbox instance (or any object with sandbox.process.executeCommand)
 * @returns SandboxGit interface for git operations
 *
 * @example
 * ```typescript
 * // With Daytona SDK sandbox
 * import { Daytona } from "@daytonaio/sdk"
 * import { createSandboxGit } from "@upstream/common/daytona-git"
 *
 * const daytona = new Daytona({ apiKey })
 * const sandbox = await daytona.get(sandboxId)
 * const git = createSandboxGit(sandbox)
 *
 * // Now use git.* instead of sandbox.git.*
 * await git.clone(url, path, branch, undefined, "x-access-token", token)
 * ```
 */
export function createSandboxGit(sandbox: SandboxLike): SandboxGit {
  const { process } = sandbox

  return {
    clone: (
      url: string,
      path: string,
      branch?: string,
      commitId?: string,
      username?: string,
      password?: string
    ): Promise<void> => {
      return commands.clone(process, url, path, branch, commitId, username, password)
    },

    createBranch: (path: string, branchName: string): Promise<void> => {
      return commands.createBranch(process, path, branchName)
    },

    checkoutBranch: (path: string, branchName: string): Promise<void> => {
      return commands.checkoutBranch(process, path, branchName)
    },

    status: (path: string): Promise<GitStatus> => {
      return commands.status(process, path)
    },

    pull: (path: string, username?: string, password?: string): Promise<void> => {
      return commands.pull(process, path, username, password)
    },

    push: (path: string, username?: string, password?: string): Promise<void> => {
      return commands.push(process, path, username, password)
    },
  }
}

/**
 * Convenience export for direct command usage
 *
 * Useful when you want to call commands directly without creating
 * a SandboxGit instance, or for testing individual commands.
 *
 * @example
 * ```typescript
 * import { gitCommands } from "@upstream/common/daytona-git"
 *
 * await gitCommands.clone(sandbox.process, url, path, branch)
 * ```
 */
export const gitCommands = commands
