import { randomUUID } from "crypto"

export function generateSandboxName(userId: string): string {
  const uuid = randomUUID().split("-")[0] // First segment for brevity (8 chars)
  const userIdPrefix = userId.slice(0, 8)
  return `upstream-${userIdPrefix}-${uuid}`
}
