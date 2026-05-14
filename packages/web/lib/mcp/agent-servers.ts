/**
 * Load a chat's connected MCP servers in the shape `setupMcpForAgent` wants.
 *
 * Two kinds of rows:
 *   - Smithery rows  → decrypt the stored Smithery API key for the bearer.
 *   - GitHub row     → mint a fresh installation token via getInstallationToken
 *                      (tokens are 1-hour, so we re-mint on every turn instead
 *                      of trying to keep them in sync with the DB).
 */
import { prisma } from "@/lib/db/prisma"
import { decrypt } from "@/lib/db/encryption"
import {
  GITHUB_MCP_QUALIFIED_NAME,
  safeServerName,
} from "@upstream/mcp-providers"
import { getInstallationToken } from "@/lib/github/app"
import type { AgentMcpServer } from "@upstream/agent-configuration/mcp"

export async function loadChatMcpServers(
  chatId: string
): Promise<AgentMcpServer[]> {
  const rows = await prisma.chatMcpServer.findMany({
    where: { chatId, status: "connected" },
    select: {
      qualifiedName: true,
      mcpUrl: true,
      encryptedApiKey: true,
      chat: { select: { user: { select: { githubAppInstallationId: true } } } },
    },
  })

  const out: AgentMcpServer[] = []
  for (const row of rows) {
    if (!row.mcpUrl) continue

    if (row.qualifiedName === GITHUB_MCP_QUALIFIED_NAME) {
      const installationId = row.chat.user.githubAppInstallationId
      if (!installationId) {
        // Row exists but App has been uninstalled — skip silently so the agent
        // doesn't get a row with no usable auth.
        continue
      }
      try {
        const token = await getInstallationToken(installationId)
        out.push({
          name: safeServerName(row.qualifiedName),
          url: row.mcpUrl,
          bearerToken: token,
        })
      } catch (err) {
        console.error(
          "[agent-servers] failed to mint GitHub installation token:",
          err
        )
      }
      continue
    }

    if (!row.encryptedApiKey) continue
    out.push({
      name: safeServerName(row.qualifiedName),
      url: row.mcpUrl,
      bearerToken: decrypt(row.encryptedApiKey),
    })
  }
  return out
}
