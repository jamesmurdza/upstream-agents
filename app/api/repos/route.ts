import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const repos = await prisma.repo.findMany({
    where: { userId: session.user.id },
    include: {
      branches: {
        include: {
          sandbox: true,
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return Response.json({ repos })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { name, owner, avatar, defaultBranch } = body

  if (!name || !owner || !defaultBranch) {
    return Response.json({ error: "Missing required fields" }, { status: 400 })
  }

  // Check if repo already exists for this user
  const existingRepo = await prisma.repo.findUnique({
    where: {
      userId_owner_name: {
        userId: session.user.id,
        owner,
        name,
      },
    },
  })

  if (existingRepo) {
    return Response.json({ error: "Repository already added" }, { status: 409 })
  }

  const repo = await prisma.repo.create({
    data: {
      userId: session.user.id,
      name,
      owner,
      avatar,
      defaultBranch,
    },
    include: {
      branches: true,
    },
  })

  return Response.json({ repo })
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const repoId = searchParams.get("id")

  if (!repoId) {
    return Response.json({ error: "Missing repo ID" }, { status: 400 })
  }

  // Verify ownership
  const repo = await prisma.repo.findUnique({
    where: { id: repoId },
  })

  if (!repo || repo.userId !== session.user.id) {
    return Response.json({ error: "Repo not found" }, { status: 404 })
  }

  await prisma.repo.delete({
    where: { id: repoId },
  })

  return Response.json({ success: true })
}
