import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function getAuthenticatedUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { credentials: true },
  })

  if (!user) {
    return null
  }

  return { session, user }
}

export function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 })
}

export function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 })
}

export function notFound(message: string = "Not found") {
  return Response.json({ error: message }, { status: 404 })
}
