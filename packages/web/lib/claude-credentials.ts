import { prisma } from "@/lib/db/prisma"

// Re-export everything from the extracted package
export {
  CLAUDE_CREDS_KEY,
  CLAUDE_COOKIES_KEY,
  generateClaudeCredentials,
  isClaudeOAuthCredentials,
  type ClaudeOAuthCredentials,
  type GenerateCredentialsOptions,
} from "@upstream/claude-credentials"

// Import the constant we need locally
import { CLAUDE_CREDS_KEY } from "@upstream/claude-credentials"

/**
 * Reads the shared Claude Code credentials row from Postgres.
 *
 * Returns the raw JSON string in the shape `{"claudeAiOauth": {...}}` —
 * exactly what `CLAUDE_CODE_CREDENTIALS` expects (and what the user would
 * otherwise paste into Settings as `anthropicAuthToken`).
 *
 * No cache. The token's expiry is the only freshness contract; the cron
 * keeps the row refreshed at least 2 hours ahead of expiry.
 */
export async function getClaudeCredentials(): Promise<string> {
  const row = await prisma.ccAuthInfo.findUnique({
    where: { id: CLAUDE_CREDS_KEY },
    select: { value: true },
  })
  if (!row) {
    throw new Error(
      `CcAuthInfo row '${CLAUDE_CREDS_KEY}' not found in database`,
    )
  }
  return row.value
}

/**
 * Returns true when the shared Claude credential pool has been seeded
 * (the cron has written at least one credentials row). Used to advertise
 * the fallback in client-side credential flags so the UI lets users pick
 * Claude Code without pasting their own token.
 *
 * Note: existence check only — doesn't validate expiry. If the row is
 * stale, /api/agent/execute still returns 503 SHARED_CREDS_UNAVAILABLE,
 * which is the correct surface.
 */
export async function isSharedPoolAvailable(): Promise<boolean> {
  const row = await prisma.ccAuthInfo.findUnique({
    where: { id: CLAUDE_CREDS_KEY },
    select: { id: true },
  })
  return !!row
}
