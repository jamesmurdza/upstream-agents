import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ensureSandboxStarted } from "@/lib/sandbox-resume"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { sandboxId } = body

  if (!sandboxId) {
    return Response.json({ error: "Missing sandbox ID" }, { status: 400 })
  }

  // Verify ownership
  const sandboxRecord = await prisma.sandbox.findUnique({
    where: { sandboxId },
  })

  if (!sandboxRecord || sandboxRecord.userId !== session.user.id) {
    return Response.json({ error: "Sandbox not found" }, { status: 404 })
  }

  const daytonaApiKey = process.env.DAYTONA_API_KEY
  if (!daytonaApiKey) {
    return Response.json({ error: "Server configuration error" }, { status: 500 })
  }

  try {
    const sandbox = await ensureSandboxStarted(daytonaApiKey, sandboxId)
    const sshAccess = await sandbox.createSshAccess(60)
    return Response.json({ sshCommand: sshAccess.sshCommand })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
