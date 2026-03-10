import { Daytona } from "@daytonaio/sdk"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
    const daytona = new Daytona({ apiKey: daytonaApiKey })
    const sandbox = await daytona.get(sandboxId)
    await sandbox.delete()

    // Delete from database
    await prisma.sandbox.delete({
      where: { id: sandboxRecord.id },
    })

    return Response.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    // Still try to delete from DB even if Daytona delete fails
    await prisma.sandbox.delete({
      where: { id: sandboxRecord.id },
    }).catch(() => {})
    return Response.json({ error: message }, { status: 500 })
  }
}
