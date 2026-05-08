import { NextRequest } from "next/server"
import {
  requireAuth,
  isAuthError,
  badRequest,
  internalError,
} from "@/lib/db/api-helpers"

// =============================================================================
// GET - Search skills from Skills.sh registry
// =============================================================================

const SKILLS_API_BASE = "https://skills.sh"

// Actual Skills.sh API response shape
interface SkillsApiResult {
  id: string        // e.g. "vercel-labs/agent-skills/vercel-react-best-practices"
  skillId: string   // e.g. "vercel-react-best-practices"
  name: string      // e.g. "vercel-react-best-practices"
  installs: number  // e.g. 378800
  source: string    // e.g. "vercel-labs/agent-skills" (owner/repo)
}

export async function GET(req: NextRequest): Promise<Response> {
  const authResult = await requireAuth()
  if (isAuthError(authResult)) return authResult

  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q")

  if (!query?.trim()) {
    return badRequest("q (search query) is required")
  }

  try {
    const apiUrl = new URL("/api/search", SKILLS_API_BASE)
    apiUrl.searchParams.set("q", query.trim())

    const response = await fetch(apiUrl.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.error(
        `[skills/search] Skills.sh API error: ${response.status} ${response.statusText}`
      )
      return Response.json(
        { error: "Skills registry unavailable", results: [] },
        { status: 502 }
      )
    }

    const data = await response.json()

    // Normalize the response into our SkillSearchResult shape
    // source = "owner/repo", skillId = skill name within that repo
    // fullHandle = "owner/repo/skillId" — unique per skill
    // install via: npx skills add owner/repo --skill skillId
    const results = (data.skills ?? []).map((item: SkillsApiResult) => {
      const source = item.source ?? ""
      const skillId = item.skillId ?? item.name ?? ""
      return {
        publisher: source.split("/")[0] ?? "",
        name: item.name ?? skillId,
        fullHandle: `${source}/${skillId}`, // unique key: "owner/repo/skillId"
        source,                              // "owner/repo" for install command
        skillId,                             // individual skill within the repo
        description: "",
        url: `https://skills.sh/skills/${source}/${skillId}`,
        installs: item.installs ?? 0,
      }
    })

    return Response.json({ results })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return Response.json(
        { error: "Skills registry timed out", results: [] },
        { status: 504 }
      )
    }
    return internalError(error)
  }
}
