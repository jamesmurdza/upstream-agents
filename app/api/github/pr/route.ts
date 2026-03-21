import { prisma } from "@/lib/prisma"
import { requireGitHubAuth, isGitHubAuthError, badRequest, internalError } from "@/lib/api-helpers"
import { compareBranches, createPullRequest, getDiff, isGitHubApiError } from "@/lib/github-client"
import { createPRSchema, validateBody, isValidationError } from "@/lib/schemas"
import { generatePRDescription } from "@/lib/pr-description"

export async function POST(req: Request) {
  const auth = await requireGitHubAuth()
  if (isGitHubAuthError(auth)) return auth

  const body = await req.json()
  const validation = validateBody(body, createPRSchema)
  if (isValidationError(validation)) {
    return badRequest(validation.error)
  }

  const { owner, repo, head, base } = validation.data

  try {
    // Get commits and diff between base and head for AI-powered PR description
    let commits: Array<{ message: string }> = []
    let diff: string | undefined

    try {
      // Fetch commits
      const compareData = await compareBranches(auth.token, owner, repo, base, head)
      commits = (compareData.commits || []).map((c) => ({ message: c.commit.message }))

      // Fetch diff for better AI context
      if (commits.length > 0) {
        try {
          diff = await getDiff(auth.token, owner, repo, { base, head })
        } catch {
          // Diff fetch failed, continue without it
          console.log("[PR] Could not fetch diff, continuing without it")
        }
      }
    } catch {
      // Ignore compare errors, will use fallback description
      console.log("[PR] Could not compare branches, using fallback")
    }

    // Generate AI-powered PR description and title
    const prResult = await generatePRDescription({
      userId: auth.userId,
      branchName: head,
      baseBranch: base,
      commits,
      diff,
    })

    console.log("[PR] Description generated:", {
      isAiGenerated: prResult.isAiGenerated,
      reason: prResult.reason,
      titleLength: prResult.title.length,
      descriptionLength: prResult.description.length,
    })

    const title = prResult.title
    const prBody = prResult.description

    // Create the PR with AI-generated content
    const prData = await createPullRequest(auth.token, owner, repo, {
      title,
      body: prBody,
      head,
      base,
    })

    // Update branch with PR URL
    const branchRecord = await prisma.branch.findFirst({
      where: {
        name: head,
        repo: {
          owner,
          name: repo,
          userId: auth.userId,
        },
      },
    })
    if (branchRecord) {
      await prisma.branch.update({
        where: { id: branchRecord.id },
        data: { prUrl: prData.html_url },
      })
    }

    return Response.json({
      url: prData.html_url,
      number: prData.number,
      title: prData.title,
    })
  } catch (error: unknown) {
    if (isGitHubApiError(error)) {
      return Response.json({ error: error.message }, { status: error.status })
    }
    return internalError(error)
  }
}
