import { generateWithUserLLM } from "@/lib/llm"

const PR_DESCRIPTION_PROMPT = `You are an expert at writing clear, professional pull request descriptions.

Based on the information below, generate a well-structured PR description.

Branch Name: {branchName}
Base Branch: {baseBranch}

Commits in this PR:
{commits}

Code Changes (Diff):
{diff}

Generate a PR description with the following sections:

## Summary
[Write 1-2 sentences explaining the purpose of this PR - what problem it solves or what feature it adds]

## Changes
[List the key changes as bullet points - be specific but concise]

## Type of Change
[Select ONE: feature | bugfix | refactor | docs | test | chore | style]

## Testing
[Briefly describe how to test these changes, or note if tests are included]

---
*Generated with AI assistance*

Requirements:
- Be concise but informative
- Focus on the "why" not just the "what"
- Use professional language
- Format in proper Markdown
- If the diff is large, focus on the most significant changes
- Infer the type of change from the commits and diff

Reply with ONLY the PR description in the format above, nothing else.`

const DEFAULT_PR_DESCRIPTION = "Automated PR"

/**
 * Parse conventional commit messages to extract type and scope
 */
function parseConventionalCommits(
  commits: Array<{ message: string }>
): { types: string[]; scopes: string[] } {
  const types: string[] = []
  const scopes: string[] = []

  const conventionalCommitRegex = /^(\w+)(?:\(([^)]+)\))?:\s/

  for (const commit of commits) {
    const match = commit.message.match(conventionalCommitRegex)
    if (match) {
      if (match[1]) types.push(match[1])
      if (match[2]) scopes.push(match[2])
    }
  }

  return {
    types: [...new Set(types)],
    scopes: [...new Set(scopes)],
  }
}

/**
 * Summarize a diff to reduce token usage while preserving key information
 */
function summarizeDiff(diff: string, maxLength: number = 6000): string {
  if (!diff || diff.trim().length === 0) {
    return "[No diff available]"
  }

  if (diff.length <= maxLength) {
    return diff
  }

  // Split by file sections and prioritize important files
  const fileSections = diff.split(/^diff --git/m).filter(Boolean)

  // Prioritize: .ts/.tsx files, then .js/.jsx, then others
  // Deprioritize: .lock files, node_modules, generated files
  const prioritized = fileSections.sort((a, b) => {
    const getPriority = (section: string): number => {
      if (section.includes("package-lock.json") || section.includes("yarn.lock")) return -10
      if (section.includes("node_modules/")) return -10
      if (section.includes(".generated.")) return -5
      if (section.includes(".ts") || section.includes(".tsx")) return 10
      if (section.includes(".js") || section.includes(".jsx")) return 8
      if (section.includes(".css") || section.includes(".scss")) return 5
      return 0
    }
    return getPriority(b) - getPriority(a)
  })

  // Rebuild diff with prioritized sections until we hit the limit
  let result = ""
  let fileCount = 0

  for (const section of prioritized) {
    const sectionWithHeader = `diff --git${section}`
    if (result.length + sectionWithHeader.length > maxLength - 100) {
      break
    }
    result += sectionWithHeader
    fileCount++
  }

  const totalFiles = fileSections.length
  if (fileCount < totalFiles) {
    result += `\n\n... (${totalFiles - fileCount} more files not shown)`
  }

  return result
}

/**
 * Generate a smart PR title from branch name and commits
 */
export function generatePRTitle(
  branchName: string,
  commits: Array<{ message: string }>
): string {
  // If there's exactly one commit, use its message as the title
  if (commits.length === 1) {
    const message = commits[0].message.split("\n")[0].trim()
    // Remove conventional commit prefix for cleaner title if desired
    // Or keep it for consistency
    return message.slice(0, 72)
  }

  // Check for conventional commit patterns to determine type
  const { types, scopes } = parseConventionalCommits(commits)

  // Generate title from branch name
  let title = branchName
    // Remove common prefixes
    .replace(/^(feature|feat|fix|bugfix|hotfix|chore|refactor|docs|test)[-/_]/i, "")
    // Replace separators with spaces
    .replace(/[-_]/g, " ")
    // Title case
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()

  // Add type prefix if we detected one
  if (types.length === 1) {
    const type = types[0].toLowerCase()
    title = `${type}: ${title.charAt(0).toLowerCase()}${title.slice(1)}`
  }

  return title.slice(0, 72)
}

export interface GeneratePRDescriptionOptions {
  userId: string
  branchName: string
  baseBranch: string
  commits: Array<{ message: string }>
  diff?: string
}

export interface GeneratePRDescriptionResult {
  description: string
  title: string
  isAiGenerated: boolean
  reason?: "no_api_key" | "no_commits" | "llm_error" | "success"
}

/**
 * Generates a PR description using AI if available, otherwise returns a basic description.
 * This function is designed to never throw - it always returns a valid PR description.
 */
export async function generatePRDescription(
  options: GeneratePRDescriptionOptions
): Promise<GeneratePRDescriptionResult> {
  const { userId, branchName, baseBranch, commits, diff } = options

  // Generate a smart title regardless of AI availability
  const title = generatePRTitle(branchName, commits)

  // If no commits, use default
  if (!commits || commits.length === 0) {
    return {
      description: DEFAULT_PR_DESCRIPTION,
      title,
      isAiGenerated: false,
      reason: "no_commits",
    }
  }

  // Format commits for the prompt
  const commitsText = commits
    .map((c, i) => `${i + 1}. ${c.message}`)
    .join("\n")

  // Summarize diff to stay within token limits
  const summarizedDiff = summarizeDiff(diff || "", 6000)

  const prompt = PR_DESCRIPTION_PROMPT
    .replace("{branchName}", branchName)
    .replace("{baseBranch}", baseBranch)
    .replace("{commits}", commitsText)
    .replace("{diff}", summarizedDiff)

  const result = await generateWithUserLLM({ userId, prompt })

  if (result.error || !result.text) {
    console.log("[generatePRDescription] LLM failed or unavailable:", {
      error: result.error,
      hasText: !!result.text,
      commitCount: commits.length,
    })

    // Fallback: Create a basic description from commits
    const fallbackDescription = createFallbackDescription(commits, branchName)

    return {
      description: fallbackDescription,
      title,
      isAiGenerated: false,
      reason: result.error || "llm_error",
    }
  }

  console.log("[generatePRDescription] AI generated description successfully")

  return {
    description: result.text,
    title,
    isAiGenerated: true,
    reason: "success",
  }
}

/**
 * Creates a fallback PR description when AI is unavailable
 */
function createFallbackDescription(
  commits: Array<{ message: string }>,
  branchName: string
): string {
  const { types } = parseConventionalCommits(commits)

  let typeLabel = "Changes"
  if (types.length > 0) {
    const typeMap: Record<string, string> = {
      feat: "Features",
      fix: "Bug Fixes",
      refactor: "Refactoring",
      docs: "Documentation",
      test: "Tests",
      chore: "Maintenance",
      style: "Styling",
    }
    typeLabel = typeMap[types[0]] || "Changes"
  }

  const commitList = commits
    .map((c) => `- ${c.message.split("\n")[0]}`)
    .join("\n")

  return `## Summary
This PR contains changes from the \`${branchName}\` branch.

## ${typeLabel}
${commitList}

## Testing
Please review the changes and test accordingly.
`
}
