/**
 * OAuth credential structure returned by ccauth.
 * This is the shape stored in CLAUDE_CODE_CREDENTIALS and
 * expected by Claude Code CLI.
 */
export interface ClaudeOAuthCredentials {
  claudeAiOauth: {
    accessToken: string
    refreshToken: string
    expiresAt: number
    scopes: string[]
    subscriptionType?: string
    rateLimitTier?: string
  }
}
