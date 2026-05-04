/**
 * Git command implementations
 *
 * Each function executes git commands in the sandbox via sandbox.process.executeCommand().
 * Credentials are passed via environment variables to avoid exposure in process list.
 */

import type { SandboxProcess, GitStatus } from "./types"
import { withAuth } from "./auth"
import { createGitError } from "./errors"
import { parseGitStatus } from "./parsers"

/**
 * Escape a shell argument to prevent injection
 */
function esc(arg: string): string {
  return `'${arg.replace(/'/g, "'\\''")}'`
}

/**
 * Execute a command in the sandbox and throw on failure
 */
async function exec(
  process: SandboxProcess,
  command: string,
  allowFailure = false
): Promise<string> {
  const result = await process.executeCommand(command)
  if (result.exitCode !== 0 && !allowFailure) {
    throw createGitError(command, result.exitCode, result.result)
  }
  return result.result
}

/**
 * Clone a repository
 */
export async function clone(
  process: SandboxProcess,
  url: string,
  path: string,
  branch?: string,
  commitId?: string,
  token?: string
): Promise<void> {
  const branchFlag = branch ? `-b ${esc(branch)}` : ""
  const cloneCmd = `clone --single-branch ${branchFlag} ${esc(url)} ${esc(path)} 2>&1`

  if (token) {
    await exec(process, withAuth(token, cloneCmd))
  } else {
    await exec(process, `git ${cloneCmd}`)
  }

  if (commitId) {
    await exec(process, `cd ${esc(path)} && git checkout ${esc(commitId)} 2>&1`)
  }
}

/**
 * Create a new branch at current HEAD
 */
export async function createBranch(
  process: SandboxProcess,
  path: string,
  branchName: string
): Promise<void> {
  await exec(process, `cd ${esc(path)} && git branch ${esc(branchName)} 2>&1`)
}

/**
 * Checkout/switch to a branch
 */
export async function checkoutBranch(
  process: SandboxProcess,
  path: string,
  branchName: string
): Promise<void> {
  await exec(process, `cd ${esc(path)} && git checkout ${esc(branchName)} 2>&1`)
}

/**
 * Get repository status
 */
export async function status(
  process: SandboxProcess,
  path: string
): Promise<GitStatus> {
  const porcelainOutput = await exec(
    process,
    `cd ${esc(path)} && git status --porcelain -b 2>&1`
  )

  const aheadBehindOutput = await exec(
    process,
    `cd ${esc(path)} && git rev-list --left-right --count @{upstream}...HEAD 2>/dev/null || echo "0 0"`,
    true
  )

  return parseGitStatus(porcelainOutput, aheadBehindOutput)
}

/**
 * Fetch from remote
 */
export async function fetch(
  process: SandboxProcess,
  path: string,
  token?: string,
  refspec?: string
): Promise<void> {
  const ref = refspec ?? ""
  const fetchCmd = `fetch origin ${ref} 2>&1`
  if (token) {
    await exec(process, `cd ${esc(path)} && ${withAuth(token, fetchCmd)}`)
  } else {
    await exec(process, `cd ${esc(path)} && git ${fetchCmd}`)
  }
}

/**
 * Fetch a specific branch and ensure its remote tracking ref is created.
 * This is needed for single-branch clones where `git fetch origin <branch>`
 * alone does not create `origin/<branch>`.
 */
export async function fetchBranch(
  process: SandboxProcess,
  path: string,
  branch: string,
  token?: string
): Promise<void> {
  const refspec = `+refs/heads/${branch}:refs/remotes/origin/${branch}`
  const fetchCmd = `fetch origin ${refspec} 2>&1`
  if (token) {
    await exec(process, `cd ${esc(path)} && ${withAuth(token, fetchCmd)}`)
  } else {
    await exec(process, `cd ${esc(path)} && git ${fetchCmd}`)
  }
}

/**
 * Pull changes from remote
 */
export async function pull(
  process: SandboxProcess,
  path: string,
  token?: string
): Promise<void> {
  const pullCmd = `pull 2>&1`
  if (token) {
    await exec(process, `cd ${esc(path)} && ${withAuth(token, pullCmd)}`)
  } else {
    await exec(process, `cd ${esc(path)} && git ${pullCmd}`)
  }
}

/**
 * Push changes to remote
 *
 * Fix 1: Uses explicit branch name instead of HEAD to avoid refspec errors
 * Fix 2: Skips push in detached HEAD state (conflict mode) since there's no branch to push
 */
export async function push(
  process: SandboxProcess,
  path: string,
  token?: string
): Promise<void> {
  // Get the current branch name
  const branchName = (
    await exec(
      process,
      `cd ${esc(path)} && git rev-parse --abbrev-ref HEAD 2>&1`,
      true
    )
  ).trim()

  // Skip push in detached HEAD state (conflict mode)
  if (branchName === "HEAD") {
    throw new Error(
      "Cannot push in detached HEAD state (conflict mode). Resolve conflicts and checkout a branch first."
    )
  }

  // Use explicit branch name instead of HEAD to avoid refspec errors
  const pushCmd = `push -u origin ${esc(branchName)} 2>&1`
  if (token) {
    await exec(process, `cd ${esc(path)} && ${withAuth(token, pushCmd)}`)
  } else {
    await exec(process, `cd ${esc(path)} && git ${pushCmd}`)
  }
}
