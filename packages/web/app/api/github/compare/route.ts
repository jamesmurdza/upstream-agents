import { requireGitHubAuth, isGitHubAuthError, badRequest, notFound, internalError } from "@/lib/shared/api-helpers"
import { getDiff, compareBranches, isGitHubApiError } from "@upstream/common"

export async function POST(req: Request) {
  const auth = await requireGitHubAuth()
  if (isGitHubAuthError(auth)) return auth

  const body = await req.json()
  const { owner, repo, base, head, commitHash, includeStats } = body

  if (!owner || !repo) {
    return badRequest("Missing required fields")
  }

  if (!commitHash && (!base || !head)) {
    return badRequest("Must provide commitHash or base+head")
  }

  try {
    // If includeStats is true or we're comparing branches, also get the comparison stats
    if (includeStats && base && head) {
      const compareData = await compareBranches(auth.token, owner, repo, base, head)
      return Response.json({
        ahead_by: compareData.ahead_by,
        behind_by: compareData.behind_by,
        status: compareData.status,
      })
    }

    const diff = await getDiff(auth.token, owner, repo, { commitHash, base, head })
    return Response.json({ diff })
  } catch (error: unknown) {
    // Handle GitHub API errors with appropriate status codes
    if (isGitHubApiError(error)) {
      // 404 - Branch or commit not found
      if (error.status === 404) {
        // For comparison stats requests, return zero ahead
        if (body.includeStats) {
          return Response.json({ ahead_by: 0, behind_by: 0, status: "identical" })
        }
        return notFound("Branch or commit not found")
      }
      // For "no commits between" errors (GitHub returns 404 with specific message),
      // return empty diff instead of error
      if (error.message.includes("No commits") || error.message.includes("nothing to compare")) {
        if (body.includeStats) {
          return Response.json({ ahead_by: 0, behind_by: 0, status: "identical" })
        }
        return Response.json({ diff: "" })
      }
      // Return the actual GitHub error status for other cases
      return Response.json({ error: error.message }, { status: error.status })
    }
    return internalError(error)
  }
}
