import { Daytona } from "@daytonaio/sdk"
import { createSandboxGit } from "@upstream/daytona-git"
import { PATHS } from "@/lib/constants"
import { requireGitHubAuth, isGitHubAuthError } from "@/lib/db/api-helpers"

export async function POST(req: Request) {
  // 1. Parse request body
  const body = await req.json()
  const { sandboxId, repoName, branch } = body

  if (!sandboxId || !repoName || !branch) {
    return Response.json({ error: "Missing required fields: sandboxId, repoName, branch" }, { status: 400 })
  }

  // 2. Get GitHub token from request body first (for API access)
  // Fall back to DB token (for browser access)
  let githubToken = body.githubToken
  if (!githubToken) {
    const ghAuth = await requireGitHubAuth()
    if (isGitHubAuthError(ghAuth)) {
      return Response.json({ error: "Unauthorized - provide githubToken in body or sign in" }, { status: 401 })
    }
    githubToken = ghAuth.token
  }

  // 3. Get Daytona API key
  const daytonaApiKey = process.env.DAYTONA_API_KEY
  if (!daytonaApiKey) {
    return Response.json(
      { error: "Daytona API key not configured" },
      { status: 500 }
    )
  }

  try {
    // 4. Get sandbox from Daytona
    const daytona = new Daytona({ apiKey: daytonaApiKey })
    const sandbox = await daytona.get(sandboxId)
    const git = createSandboxGit(sandbox)

    // 5. Push to remote
    const repoPath = `${PATHS.SANDBOX_HOME}/${repoName}`

    await git.push(repoPath, githubToken)

    return Response.json({ success: true })
  } catch (error) {
    console.error("[git/push] Error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
