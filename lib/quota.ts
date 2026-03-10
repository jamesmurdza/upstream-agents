import { prisma } from "@/lib/prisma"

const MAX_CONCURRENT_SANDBOXES = 5

export async function checkQuota(userId: string): Promise<{
  allowed: boolean
  current: number
  max: number
}> {
  const activeSandboxes = await prisma.sandbox.count({
    where: {
      userId,
      status: { in: ["creating", "running", "stopped"] },
    },
  })

  return {
    allowed: activeSandboxes < MAX_CONCURRENT_SANDBOXES,
    current: activeSandboxes,
    max: MAX_CONCURRENT_SANDBOXES,
  }
}

export async function getQuota(userId: string) {
  const activeSandboxes = await prisma.sandbox.count({
    where: {
      userId,
      status: { in: ["creating", "running", "stopped"] },
    },
  })

  return {
    current: activeSandboxes,
    max: MAX_CONCURRENT_SANDBOXES,
    remaining: Math.max(0, MAX_CONCURRENT_SANDBOXES - activeSandboxes),
  }
}
