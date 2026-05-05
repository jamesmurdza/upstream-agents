/**
 * Daily usage limit for shared Claude Code subscription.
 *
 * Free users are limited to 10 Claude Code messages per day
 * when using the shared Claude credentials (no personal API key).
 * Pro users have unlimited access.
 */

import { prisma } from "./prisma"

/** Daily Claude Code message limit for free users on shared subscription */
const FREE_DAILY_CLAUDE_CODE_LIMIT = 10

export interface UsageLimitResult {
  allowed: boolean
  isPro: boolean
  remaining: number
  limit: number
  resetAt: Date
  error?: string
}

/**
 * Check if a user can send a Claude Code message using shared credentials.
 * Returns usage status including whether the request is allowed.
 *
 * This only applies to shared Claude Code subscription usage - users with
 * their own API keys have unlimited access.
 */
export async function checkSharedClaudeUsage(
  userId: string
): Promise<UsageLimitResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPro: true },
  })

  if (!user) {
    return {
      allowed: false,
      isPro: false,
      remaining: 0,
      limit: FREE_DAILY_CLAUDE_CODE_LIMIT,
      resetAt: getNextResetTime(),
      error: "User not found",
    }
  }

  // Pro users have unlimited access
  if (user.isPro) {
    return {
      allowed: true,
      isPro: true,
      remaining: Infinity,
      limit: Infinity,
      resetAt: getNextResetTime(),
    }
  }

  // Count Claude Code messages sent today using shared credentials
  const startOfDay = getStartOfDay()
  const todayCount = await prisma.activityLog.count({
    where: {
      userId,
      action: "message_sent",
      createdAt: { gte: startOfDay },
      // Only count shared Claude Code usage - metadata contains useSharedClaude: true
      metadata: {
        path: ["useSharedClaude"],
        equals: true,
      },
    },
  })

  const remaining = Math.max(0, FREE_DAILY_CLAUDE_CODE_LIMIT - todayCount)
  const allowed = todayCount < FREE_DAILY_CLAUDE_CODE_LIMIT

  return {
    allowed,
    isPro: false,
    remaining,
    limit: FREE_DAILY_CLAUDE_CODE_LIMIT,
    resetAt: getNextResetTime(),
    error: allowed
      ? undefined
      : `Daily limit of ${FREE_DAILY_CLAUDE_CODE_LIMIT} free Claude Code messages reached. Upgrade to Pro for unlimited usage.`,
  }
}

/**
 * Get the start of the current day (midnight UTC).
 */
function getStartOfDay(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/**
 * Get the next reset time (midnight UTC tomorrow).
 */
function getNextResetTime(): Date {
  const startOfDay = getStartOfDay()
  return new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)
}

/**
 * Get the current daily Claude Code limit constant.
 */
export function getDailyClaudeCodeLimit(): number {
  return FREE_DAILY_CLAUDE_CODE_LIMIT
}
