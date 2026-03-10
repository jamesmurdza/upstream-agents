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
  const { sandboxId, action } = body

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

    if (action === "stop") {
      await sandbox.stop()
      await prisma.sandbox.update({
        where: { id: sandboxRecord.id },
        data: { status: "stopped" },
      })
      return Response.json({ state: "stopped" })
    }

    if (action === "start") {
      await sandbox.start(120)
      await prisma.sandbox.update({
        where: { id: sandboxRecord.id },
        data: { status: "running" },
      })
      return Response.json({ state: "started" })
    }

    // Update status in DB based on actual state
    const dbStatus = sandbox.state === "started" ? "running" : "stopped"
    if (sandboxRecord.status !== dbStatus) {
      await prisma.sandbox.update({
        where: { id: sandboxRecord.id },
        data: { status: dbStatus },
      })
    }

    return Response.json({ state: sandbox.state })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
