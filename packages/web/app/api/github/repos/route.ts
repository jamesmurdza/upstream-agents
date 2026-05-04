import { requireGitHubAuth, isGitHubAuthError } from "@/lib/db/api-helpers"
import { getUserRepos } from "@upstream/common"

export async function GET() {
  const ghAuth = await requireGitHubAuth()
  if (isGitHubAuthError(ghAuth)) return ghAuth

  try {
    const repos = await getUserRepos(ghAuth.token, {
      sort: "updated",
      perPage: 100,
      affiliation: "owner,collaborator,organization_member",
    })
    return Response.json({ repos })
  } catch (error: unknown) {
    console.error("[github/repos] Error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
