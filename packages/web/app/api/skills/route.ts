import { NextRequest } from "next/server"
import { prisma } from "@/lib/db/prisma"
import {
  requireAuth,
  isAuthError,
  badRequest,
  internalError,
} from "@/lib/db/api-helpers"
import { NEW_REPOSITORY } from "@/lib/types"

// =============================================================================
// GET - List installed skills for a repo
// =============================================================================

export async function GET(req: NextRequest): Promise<Response> {
  const authResult = await requireAuth()
  if (isAuthError(authResult)) return authResult
  const { userId } = authResult

  const { searchParams } = new URL(req.url)
  const repo = searchParams.get("repo")

  if (!repo || repo === NEW_REPOSITORY) {
    return badRequest("repo is required and must be a valid owner/repo")
  }

  try {
    const skills = await prisma.skill.findMany({
      where: { userId, repo },
      orderBy: { createdAt: "desc" },
    })

    return Response.json({
      skills: skills.map((s) => ({
        id: s.id,
        repo: s.repo,
        publisher: s.publisher,
        name: s.name,
        fullHandle: s.fullHandle,
        url: s.url,
        createdAt: s.createdAt.getTime(),
        updatedAt: s.updatedAt.getTime(),
      })),
    })
  } catch (error) {
    return internalError(error)
  }
}

// =============================================================================
// POST - Bulk install skills for a repo
// =============================================================================

interface SkillInput {
  publisher: string
  name: string
  fullHandle: string
  url?: string
}

interface InstallSkillsBody {
  repo: string
  skills: SkillInput[]
}

export async function POST(req: NextRequest): Promise<Response> {
  const authResult = await requireAuth()
  if (isAuthError(authResult)) return authResult
  const { userId } = authResult

  try {
    const body: InstallSkillsBody = await req.json()

    if (!body.repo || body.repo === NEW_REPOSITORY) {
      return badRequest("repo is required and must be a valid owner/repo")
    }

    if (!body.skills || !Array.isArray(body.skills) || body.skills.length === 0) {
      return badRequest("skills array is required and must not be empty")
    }

    // Validate each skill
    for (const skill of body.skills) {
      if (!skill.publisher?.trim() || !skill.name?.trim() || !skill.fullHandle?.trim()) {
        return badRequest("Each skill must have publisher, name, and fullHandle")
      }
    }

    // Upsert each skill (idempotent — re-installing the same skill is a no-op)
    const created = await prisma.$transaction(
      body.skills.map((skill) =>
        prisma.skill.upsert({
          where: {
            userId_repo_fullHandle: {
              userId,
              repo: body.repo,
              fullHandle: skill.fullHandle,
            },
          },
          create: {
            userId,
            repo: body.repo,
            publisher: skill.publisher.trim(),
            name: skill.name.trim(),
            fullHandle: skill.fullHandle.trim(),
            url: skill.url ?? null,
          },
          update: {
            url: skill.url ?? undefined,
          },
        })
      )
    )

    return Response.json(
      {
        skills: created.map((s) => ({
          id: s.id,
          repo: s.repo,
          publisher: s.publisher,
          name: s.name,
          fullHandle: s.fullHandle,
          url: s.url,
          createdAt: s.createdAt.getTime(),
          updatedAt: s.updatedAt.getTime(),
        })),
      },
      { status: 201 }
    )
  } catch (error) {
    return internalError(error)
  }
}
