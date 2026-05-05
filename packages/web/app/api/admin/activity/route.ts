import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { requireAdmin, isAuthError } from "@/lib/db/api-helpers"

/**
 * GET /api/admin/activity
 * Returns paginated activity log entries
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 50, max: 100)
 * - action: Filter by action type (optional)
 * - userId: Filter by user ID (optional)
 * - agent: Filter by agent name (optional, queries metadata->>'agent')
 * - model: Filter by model name (optional, queries metadata->>'model')
 * - dateFrom: Start date ISO string (optional)
 * - dateTo: End date ISO string (optional)
 * - includeFilters: If "true", returns distinct action/agent/model values for filters
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (isAuthError(auth)) return auth

  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)))
  const action = searchParams.get("action")
  const userId = searchParams.get("userId")
  const agent = searchParams.get("agent")
  const model = searchParams.get("model")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  const includeFilters = searchParams.get("includeFilters") === "true"

  const skip = (page - 1) * limit

  // Build where clause
  const where: {
    action?: string
    userId?: string
    createdAt?: Record<string, Date>
    AND?: Array<Record<string, unknown>>
  } = {}

  if (action) where.action = action
  if (userId) where.userId = userId

  // Date range filtering
  if (dateFrom || dateTo) {
    where.createdAt = {}
    if (dateFrom) where.createdAt.gte = new Date(dateFrom)
    if (dateTo) where.createdAt.lte = new Date(dateTo)
  }

  // Agent and model filtering (JSONB metadata queries)
  if (agent || model) {
    where.AND = []
    if (agent) {
      where.AND.push({
        metadata: { path: ["agent"], equals: agent },
      })
    }
    if (model) {
      where.AND.push({
        metadata: { path: ["model"], equals: model },
      })
    }
  }

  // Fetch distinct filter values if requested
  const filtersPromise = includeFilters
    ? Promise.all([
        prisma.activityLog.findMany({
          select: { action: true },
          distinct: ["action"],
        }).then((rows) => rows.map((r) => r.action)),
        prisma.$queryRaw<Array<{ value: string }>>`
          SELECT DISTINCT metadata->>'agent' as value
          FROM "ActivityLog"
          WHERE metadata->>'agent' IS NOT NULL AND metadata->>'agent' != ''
          ORDER BY value ASC
        `,
        prisma.$queryRaw<Array<{ value: string }>>`
          SELECT DISTINCT metadata->>'model' as value
          FROM "ActivityLog"
          WHERE metadata->>'model' IS NOT NULL AND metadata->>'model' != ''
          ORDER BY value ASC
        `,
      ]).then(([actions, agents, models]) => ({
        actions,
        agents: agents.map((r) => r.value),
        models: models.map((r) => r.value),
      }))
    : Promise.resolve(null)

  // Fetch activity logs with user info
  const [activities, total, filters] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.activityLog.count({ where }),
    filtersPromise,
  ])

  return NextResponse.json({
    activities: activities.map((activity) => ({
      id: activity.id,
      userId: activity.userId,
      userName: activity.user.name,
      userEmail: activity.user.email,
      userImage: activity.user.image,
      action: activity.action,
      metadata: activity.metadata,
      createdAt: activity.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    ...(filters ? { filters } : {}),
  })
}
