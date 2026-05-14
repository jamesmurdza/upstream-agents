/**
 * GitHub App helpers — re-exports from @upstream/mcp-providers.
 *
 * This file maintains backwards compatibility for existing imports while
 * delegating to the shared mcp-providers package.
 */

import {
  createGitHubMcpProvider,
  GITHUB_MCP_URL,
  GITHUB_MCP_QUALIFIED_NAME,
} from "@upstream/mcp-providers"

// Re-export constants
export { GITHUB_MCP_URL, GITHUB_MCP_QUALIFIED_NAME }

// Lazily-initialized provider instance using env vars
let provider: ReturnType<typeof createGitHubMcpProvider> | null = null

function getProvider() {
  if (provider) return provider

  const appId = process.env.GITHUB_APP_ID
  const appSlug = process.env.GITHUB_APP_SLUG
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY

  if (!appId || !appSlug || !privateKey) {
    throw new Error(
      "GitHub App not configured: GITHUB_APP_ID, GITHUB_APP_SLUG, and GITHUB_APP_PRIVATE_KEY are required"
    )
  }

  provider = createGitHubMcpProvider({ appId, appSlug, privateKey })
  return provider
}

/**
 * Get a fresh installation token. Refreshes lazily when within
 * 5 minutes of expiry so callers never get an about-to-die token.
 */
export async function getInstallationToken(
  installationId: string
): Promise<string> {
  return getProvider().getToken(installationId)
}

/** Drop a cached token — used after disconnect. */
export function invalidateInstallationToken(installationId: string): void {
  getProvider().invalidateToken(installationId)
}

/** Where to send the user to install/authorize the App. */
export function getInstallUrl(): string {
  return getProvider().getInstallUrl()
}
