import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/encryption"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { anthropicApiKey, anthropicAuthType, anthropicAuthToken } = body

  if (!anthropicAuthType || !["api-key", "claude-max"].includes(anthropicAuthType)) {
    return Response.json({ error: "Invalid auth type" }, { status: 400 })
  }

  // Encrypt credentials before storing
  const encryptedApiKey = anthropicApiKey ? encrypt(anthropicApiKey) : null
  const encryptedAuthToken = anthropicAuthToken ? encrypt(anthropicAuthToken) : null

  await prisma.userCredentials.upsert({
    where: { userId: session.user.id },
    update: {
      anthropicApiKey: encryptedApiKey,
      anthropicAuthType,
      anthropicAuthToken: encryptedAuthToken,
    },
    create: {
      userId: session.user.id,
      anthropicApiKey: encryptedApiKey,
      anthropicAuthType,
      anthropicAuthToken: encryptedAuthToken,
    },
  })

  return Response.json({ success: true })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  await prisma.userCredentials.deleteMany({
    where: { userId: session.user.id },
  })

  return Response.json({ success: true })
}
