import { prisma } from "@/lib/db/prisma"
import { requireAuth, isAuthError, badRequest, internalError } from "@/lib/shared/api-helpers"

/**
 * PATCH /api/user/repo-order
 * Updates the user's preferred repo display order
 */
export async function PATCH(request: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  try {
    const body = await request.json()
    const { repoOrder } = body

    // Validate that repoOrder is an array of strings
    if (!Array.isArray(repoOrder) || !repoOrder.every((id) => typeof id === "string")) {
      return badRequest("repoOrder must be an array of repo IDs")
    }

    await prisma.user.update({
      where: { id: auth.userId },
      data: { repoOrder },
    })

    return Response.json({ success: true })
  } catch (error) {
    console.error("PATCH /api/user/repo-order error:", error)
    return internalError(error)
  }
}
