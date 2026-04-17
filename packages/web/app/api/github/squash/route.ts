import { prisma } from "@/lib/db/prisma"
import { requireGitHubAuth, isGitHubAuthError, badRequest, internalError, getDaytonaApiKey, isDaytonaKeyError } from "@/lib/shared/api-helpers"
import { compareBranches, githubFetch, isGitHubApiError } from "@upstream/common"
import { ensureSandboxStarted } from "@/lib/sandbox/sandbox-resume"
import { PATHS } from "@/lib/shared/constants"

// Squash operation timeout - 60 seconds
export const maxDuration = 60

interface SquashRequestBody {
  owner: string
  repo: string
  head: string  // current branch to squash
  base: string  // base branch to squash relative to
  sandboxId: string
}

/**
 * POST /api/github/squash
 *
 * Squashes all commits on the head branch that are ahead of base into a single commit.
 * Uses GitHub API to perform the squash merge via a temp branch, then syncs the sandbox.
 *
 * Steps:
 * 1. Create a temp branch from base on GitHub
 * 2. Squash merge head into temp branch via GitHub API
 * 3. Update head branch ref to point to the squashed commit
 * 4. Delete temp branch
 * 5. Sync sandbox with git fetch + reset
 */
export async function POST(req: Request) {
  const auth = await requireGitHubAuth()
  if (isGitHubAuthError(auth)) return auth

  const body: SquashRequestBody = await req.json()
  const { owner, repo, head, base, sandboxId } = body

  if (!owner || !repo || !head || !base || !sandboxId) {
    return badRequest("Missing required fields: owner, repo, head, base, sandboxId")
  }

  // Verify sandbox ownership
  const sandboxRecord = await prisma.sandbox.findUnique({
    where: { sandboxId },
  })
  if (!sandboxRecord || sandboxRecord.userId !== auth.userId) {
    return badRequest("Sandbox not found or access denied")
  }

  const daytonaApiKey = getDaytonaApiKey()
  if (isDaytonaKeyError(daytonaApiKey)) return daytonaApiKey

  try {
    // First, verify there are commits to squash
    const compareData = await compareBranches(auth.token, owner, repo, base, head)
    if (compareData.ahead_by < 2) {
      return badRequest(`Need at least 2 commits to squash. Branch "${head}" is only ${compareData.ahead_by} commit(s) ahead of "${base}".`)
    }

    // Get the current head branch SHA (we'll need this for the commit message)
    const headRef = await githubFetch<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/refs/heads/${head}`,
      auth.token
    )
    const headSha = headRef.object.sha

    // Get the base branch SHA
    const baseRef = await githubFetch<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/refs/heads/${base}`,
      auth.token
    )
    const baseSha = baseRef.object.sha

    // Step 1: Create a temp branch from base
    const tempBranchName = `_squash-temp-${Date.now()}`
    await githubFetch(
      `/repos/${owner}/${repo}/git/refs`,
      auth.token,
      {
        method: "POST",
        body: JSON.stringify({
          ref: `refs/heads/${tempBranchName}`,
          sha: baseSha,
        }),
      }
    )

    try {
      // Step 2: Squash merge head into temp branch using GitHub's merge API
      // Note: GitHub's /repos/{owner}/{repo}/merges endpoint doesn't support squash directly
      // We need to use the pulls API to create a PR and then merge it with squash

      // Create a temporary PR
      const pr = await githubFetch<{ number: number; head: { sha: string } }>(
        `/repos/${owner}/${repo}/pulls`,
        auth.token,
        {
          method: "POST",
          body: JSON.stringify({
            title: `Squash ${head}`,
            head: head,
            base: tempBranchName,
            body: "Temporary PR for squash operation",
          }),
        }
      )

      // Merge the PR with squash
      // GitHub needs time to verify mergeability after PR creation, so we retry on "Base branch was modified" error
      let mergeResult: { sha: string; merged: boolean } | null = null
      let lastError: Error | null = null

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          // Wait a bit before merge to let GitHub's mergeability check complete
          if (attempt > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
          }

          mergeResult = await githubFetch<{ sha: string; merged: boolean }>(
            `/repos/${owner}/${repo}/pulls/${pr.number}/merge`,
            auth.token,
            {
              method: "PUT",
              body: JSON.stringify({
                merge_method: "squash",
                commit_title: `Squashed ${compareData.ahead_by} commits from ${head}`,
              }),
            }
          )
          break // Success, exit retry loop
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
          // Only retry on "Base branch was modified" error
          if (!lastError.message.includes("Base branch was modified")) {
            throw err
          }
          console.log(`[squash] Merge attempt ${attempt + 1} failed with "Base branch was modified", retrying...`)
        }
      }

      if (!mergeResult) {
        throw lastError || new Error("Squash merge failed after retries")
      }

      if (!mergeResult.merged) {
        throw new Error("Squash merge failed")
      }

      // Get the new squashed commit SHA from the temp branch
      const tempRef = await githubFetch<{ object: { sha: string } }>(
        `/repos/${owner}/${repo}/git/refs/heads/${tempBranchName}`,
        auth.token
      )
      const squashedSha = tempRef.object.sha

      // Step 3: Update head branch to point to the squashed commit
      await githubFetch(
        `/repos/${owner}/${repo}/git/refs/heads/${head}`,
        auth.token,
        {
          method: "PATCH",
          body: JSON.stringify({
            sha: squashedSha,
            force: true,
          }),
        }
      )

      // Step 4: Delete temp branch (cleanup)
      try {
        await githubFetch(
          `/repos/${owner}/${repo}/git/refs/heads/${tempBranchName}`,
          auth.token,
          { method: "DELETE" }
        )
      } catch {
        // Best effort cleanup - don't fail the whole operation
        console.warn(`Failed to delete temp branch ${tempBranchName}`)
      }

      // Step 5: Sync sandbox with the new squashed state
      try {
        const sandbox = await ensureSandboxStarted(daytonaApiKey, sandboxId)
        const repoPath = `${PATHS.SANDBOX_HOME}/project`

        // Fetch the latest from origin
        await sandbox.process.executeCommand(
          `cd ${repoPath} && git fetch origin ${head} 2>&1`
        )

        // Ensure we're on the correct branch before resetting
        await sandbox.process.executeCommand(
          `cd ${repoPath} && git checkout ${head} 2>&1`
        )

        // Reset local branch to match the squashed remote
        await sandbox.process.executeCommand(
          `cd ${repoPath} && git reset --hard origin/${head} 2>&1`
        )
      } catch (sandboxErr) {
        // Squash succeeded on GitHub, but sandbox sync failed
        // Return success with a warning
        console.warn("Sandbox sync failed after squash:", sandboxErr)
        return Response.json({
          success: true,
          warning: "Squash completed on GitHub but sandbox sync failed. Try pulling manually.",
          squashedSha,
          commitsSquashed: compareData.ahead_by,
        })
      }

      return Response.json({
        success: true,
        squashedSha,
        commitsSquashed: compareData.ahead_by,
      })

    } catch (err) {
      // Cleanup: try to delete temp branch if it was created
      try {
        await githubFetch(
          `/repos/${owner}/${repo}/git/refs/heads/${tempBranchName}`,
          auth.token,
          { method: "DELETE" }
        )
      } catch {
        // Ignore cleanup errors
      }
      throw err
    }

  } catch (error: unknown) {
    if (isGitHubApiError(error)) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    return internalError(error)
  }
}
