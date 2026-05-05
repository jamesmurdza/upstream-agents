/**
 * Credential field metadata + storage migration shim.
 *
 * The shape itself (CredentialId / CredentialFlags / Credentials) lives in
 * @upstream/common — this module just adds simple-chat's UI metadata for
 * each credential field and the on-read normalization for legacy DB rows.
 */

import {
  type CredentialId,
  type CredentialFlags,
  type Credentials,
  type ProviderId,
} from "@upstream/common"

export type { CredentialId, CredentialFlags, Credentials, ProviderId }

/**
 * CredentialFlags enriched with server-side state (daily limit).
 * The limit metadata is used by the UI for display; the CLAUDE_DAILY_LIMIT_EXCEEDED
 * flag itself is used by getDefaultAgent/hasCredentialsForModel.
 */
export interface EffectiveFlags {
  flags: CredentialFlags
  limitResetAt: Date | null
  limitRemaining: number | null
}

export interface CredentialField {
  id: CredentialId
  provider: ProviderId
  label: string
  helpUrl?: string
  placeholder?: string
  multiline?: boolean
  description?: string
}

export const CREDENTIAL_KEYS: readonly CredentialField[] = [
  {
    id: "ANTHROPIC_API_KEY",
    provider: "anthropic",
    label: "Anthropic",
    helpUrl: "https://console.anthropic.com/",
    placeholder: "sk-ant-...",
  },
  {
    id: "CLAUDE_CODE_CREDENTIALS",
    provider: "anthropic",
    label: "Claude Subscription",
    multiline: true,
    placeholder: '{"claudeAiOauth":{"token_type":"bearer",...}}',
    description: "Claude Code only.",
  },
  {
    id: "OPENAI_API_KEY",
    provider: "openai",
    label: "OpenAI",
    helpUrl: "https://platform.openai.com/api-keys",
    placeholder: "sk-...",
  },
  {
    id: "OPENCODE_API_KEY",
    provider: "opencode",
    label: "OpenCode",
    helpUrl: "https://opencode.ai/auth",
  },
  {
    id: "GEMINI_API_KEY",
    provider: "gemini",
    label: "Google AI (Gemini)",
    helpUrl: "https://aistudio.google.com/apikey",
  },
] as const

const CREDENTIAL_IDS = new Set<string>(CREDENTIAL_KEYS.map((c) => c.id))

export function isCredentialId(value: string): value is CredentialId {
  return CREDENTIAL_IDS.has(value)
}

export function flagsFromCredentials(credentials: Credentials): CredentialFlags {
  const out: CredentialFlags = {}
  for (const { id } of CREDENTIAL_KEYS) {
    out[id] = !!credentials[id]
  }
  return out
}

/**
 * Read a stored credentials JSON blob, accepting either the new env-var
 * keys or the legacy camelCase field names. Existing rows are upgraded
 * to the new shape on the next write.
 */
const LEGACY_KEY_MAP: Record<string, CredentialId> = {
  anthropicApiKey: "ANTHROPIC_API_KEY",
  anthropicAuthToken: "CLAUDE_CODE_CREDENTIALS",
  openaiApiKey: "OPENAI_API_KEY",
  opencodeApiKey: "OPENCODE_API_KEY",
  geminiApiKey: "GEMINI_API_KEY",
}

export function normalizeStoredCredentials(
  raw: Record<string, unknown> | null | undefined
): Record<CredentialId, string> {
  const out: Partial<Record<CredentialId, string>> = {}
  if (!raw) return out as Record<CredentialId, string>
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v !== "string") continue
    if (isCredentialId(k)) {
      out[k] = v
    } else if (LEGACY_KEY_MAP[k]) {
      out[LEGACY_KEY_MAP[k]] = v
    }
  }
  return out as Record<CredentialId, string>
}

/**
 * Build effective credential flags for a user, including the daily Claude limit status.
 *
 * This is the single entry point for server-side flag resolution. It combines:
 * - Stored credentials
 * - Shared pool availability
 * - Daily limit check (only for free users using shared credentials)
 *
 * The resulting flags can be passed directly to getDefaultAgent/hasCredentialsForModel.
 */
export async function getEffectiveCredentialFlags(userId: string): Promise<EffectiveFlags> {
  const { prisma } = await import("@/lib/db/prisma")
  const { isSharedPoolAvailable } = await import("@/lib/claude-credentials")
  const { hasExceededClaudeLimit, getDailyClaudeCodeLimit } = await import("@/lib/db/usage-limit")

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credentials: true, isPro: true },
  })

  const decryptedCreds = (await import("@/lib/db/api-helpers")).decryptUserCredentials(
    user?.credentials as Record<string, unknown> | null
  )

  const flags = flagsFromCredentials(decryptedCreds)

  if (await isSharedPoolAvailable()) {
    flags.CLAUDE_SHARED_POOL_AVAILABLE = true
  }

  // Check daily limit only for free users who would use the shared pool
  // (no personal API key or subscription token)
  const hasOwnAnthropicKey = !!flags.ANTHROPIC_API_KEY || !!flags.CLAUDE_CODE_CREDENTIALS
  const usesSharedPool = flags.CLAUDE_SHARED_POOL_AVAILABLE && !hasOwnAnthropicKey

  let limitResetAt: Date | null = null
  let limitRemaining: number | null = null

  if (usesSharedPool && !user?.isPro) {
    const now = new Date()
    const exceeded = await hasExceededClaudeLimit(userId)
    flags.CLAUDE_DAILY_LIMIT_EXCEEDED = exceeded

    if (exceeded) {
      limitResetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
      limitRemaining = 0
    } else {
      const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
      const todayCount = await prisma.activityLog.count({
        where: {
          userId,
          action: "message_sent",
          createdAt: { gte: startOfDay },
          metadata: { path: ["useSharedClaude"], equals: true },
        },
      })
      limitRemaining = Math.max(0, getDailyClaudeCodeLimit() - todayCount)
      limitResetAt = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
    }
  }

  return { flags, limitResetAt, limitRemaining }
}
