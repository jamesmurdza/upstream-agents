import { BRANCH_STATUS } from "@/lib/shared/constants"
import type { Branch } from "@/lib/shared/types"

/**
 * Core git action utilities - shared between mobile and desktop
 */

export interface ToggleSandboxResult {
  success: boolean
  newStatus: typeof BRANCH_STATUS.IDLE | typeof BRANCH_STATUS.STOPPED
}

/**
 * Toggle sandbox start/stop state
 */
export async function toggleSandbox(
  sandboxId: string,
  currentStatus: Branch["status"]
): Promise<ToggleSandboxResult> {
  const isStopped = currentStatus === BRANCH_STATUS.STOPPED
  const res = await fetch("/api/sandbox/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sandboxId,
      action: isStopped ? "start" : "stop",
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error)
  return {
    success: true,
    newStatus: isStopped ? BRANCH_STATUS.IDLE : BRANCH_STATUS.STOPPED,
  }
}

export interface CreatePRResult {
  url: string
}

/**
 * Create a pull request or return existing PR URL
 */
export async function createPR(
  owner: string,
  repo: string,
  head: string,
  base: string
): Promise<CreatePRResult> {
  const res = await fetch("/api/github/pr", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ owner, repo, head, base }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error)
  return { url: data.url }
}
