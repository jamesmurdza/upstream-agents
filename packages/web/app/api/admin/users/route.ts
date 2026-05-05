import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db/prisma"
import { requireAdmin, isAuthError } from "@/lib/db/api-helpers"

/**
 * GET /api/admin/users
 * Returns paginated user list with stats
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - search: Search by name, email, or GitHub ID (optional)
 * - sortField: Field to sort by (name, email, createdAt, totalMessages, lastActivityAt)
 * - sortOrder: Sort order (asc, desc) - default: desc
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if (isAuthError(auth)) return auth

  const searchParams = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)))
  const search = searchParams.get("search")
  const sortField = searchParams.get("sortField") || "createdAt"
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc"

  const skip = (page - 1) * limit

  // Build where clause for search
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
          { githubId: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {}

  // Build orderBy for Prisma-supported fields
  type OrderByField = { name?: "asc" | "desc"; email?: "asc" | "desc"; createdAt?: "asc" | "desc" }
  let orderBy: OrderByField = { createdAt: "desc" }
  if (sortField === "name" || sortField === "email" || sortField === "createdAt") {
    orderBy = { [sortField]: sortOrder }
  }

  // Fetch users
  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        githubId: true,
        isAdmin: true,
        isPro: true,
        createdAt: true,
      },
      orderBy,
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ])

  // Get message counts for each user
  const userIds = users.map((u) => u.id)
  const messageCounts = await prisma.$queryRaw<Array<{ userId: string; count: bigint }>>`
    SELECT c."userId", COUNT(m.id)::bigint as count
    FROM "Chat" c
    INNER JOIN "Message" m ON m."chatId" = c.id
    WHERE c."userId" = ANY(${userIds})
    GROUP BY c."userId"
  `
  const messageCountMap = new Map(messageCounts.map((c) => [c.userId, Number(c.count)]))

  // Get last activity for each user
  const lastActivities = await prisma.activityLog.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: "desc" },
    distinct: ["userId"],
    select: {
      userId: true,
      createdAt: true,
      action: true,
    },
  })

  const lastActivityMap = new Map(
    lastActivities.map((a) => [a.userId, { createdAt: a.createdAt, action: a.action }])
  )

  let formattedUsers = users.map((user) => {
    const lastActivity = lastActivityMap.get(user.id)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      githubId: user.githubId,
      isAdmin: user.isAdmin,
      isPro: user.isPro,
      totalMessages: messageCountMap.get(user.id) ?? 0,
      lastActivityAt: lastActivity?.createdAt.toISOString() ?? null,
      lastActivityAction: lastActivity?.action ?? null,
      createdAt: user.createdAt.toISOString(),
    }
  })

  // Sort by computed fields in memory
  if (sortField === "totalMessages") {
    formattedUsers.sort((a, b) =>
      sortOrder === "asc" ? a.totalMessages - b.totalMessages : b.totalMessages - a.totalMessages
    )
  } else if (sortField === "lastActivityAt") {
    formattedUsers.sort((a, b) => {
      const aTime = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0
      const bTime = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0
      return sortOrder === "asc" ? aTime - bTime : bTime - aTime
    })
  }

  return NextResponse.json({
    users: formattedUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  })
}
