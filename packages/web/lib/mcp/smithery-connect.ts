/**
 * Smithery Connect — connection lifecycle helpers.
 *
 * This file maintains backwards compatibility for existing imports while
 * delegating to the shared mcp-providers package. Database operations remain
 * here since they're web-app specific.
 */

import {
  createSmitheryProvider,
  isSmitheryServer,
  type ConnectionResult,
} from "@upstream/mcp-providers"
import { encrypt } from "@/lib/db/encryption"
import { prisma } from "@/lib/db/prisma"

// Re-export types and utilities from mcp-providers
export type { ConnectionResult as SmitheryConnectionResult }
export { isSmitheryServer }

// Lazily-initialized provider instance using env vars
let provider: ReturnType<typeof createSmitheryProvider> | null = null

function getProvider(apiKey: string) {
  // Always use provided apiKey, but cache if it matches env var
  const envApiKey = process.env.SMITHERY_API_KEY
  const namespace = process.env.SMITHERY_NAMESPACE

  if (provider && envApiKey === apiKey) {
    return provider
  }

  const newProvider = createSmitheryProvider({ apiKey, namespace })

  // Only cache if using the env var API key
  if (envApiKey === apiKey) {
    provider = newProvider
  }

  return newProvider
}

/** Deterministic connection id per (chat, qualifiedName) — safe to recreate. */
export function getSmitheryConnectionId(
  chatId: string,
  qualifiedName: string
): string {
  // Slashes in qualifiedName (e.g. "exa/exa-search") would be parsed as path
  // segments by Smithery, so flatten them.
  const safeName = qualifiedName.replace(/\//g, "-")
  return `chat-${chatId}-${safeName}`
}

/**
 * Create or refresh a Smithery Connect connection for `mcpUrl`.
 * Idempotent — calling twice with the same connectionId updates in place.
 */
export async function createSmitheryConnection(
  mcpUrl: string,
  connectionId: string,
  name: string,
  apiKey: string
): Promise<ConnectionResult> {
  const smithery = getProvider(apiKey)
  return smithery.createConnection(mcpUrl, connectionId, name)
}

/**
 * After the OAuth popup closes, ping Smithery to verify the connection is now
 * `connected`. On success, persist the endpoint + encrypted API key on the
 * ChatMcpServer row so agent runs can use it.
 */
export async function finalizeSmitheryConnection(
  serverId: string,
  connectionId: string,
  apiKey: string
): Promise<boolean> {
  try {
    const smithery = getProvider(apiKey)
    const status = await smithery.getConnectionStatus(connectionId)

    if (status.state === "connected") {
      const namespace = await smithery.getNamespace()
      if (!namespace) return false

      const mcpEndpoint = smithery.getMcpEndpointWithNamespace(
        namespace,
        connectionId
      )

      await prisma.chatMcpServer.update({
        where: { id: serverId },
        data: {
          mcpUrl: mcpEndpoint,
          smitheryNamespace: namespace,
          encryptedApiKey: encrypt(apiKey),
          status: "connected",
          lastError: null,
        },
      })
      return true
    }

    return false
  } catch (err) {
    console.error("[Smithery Connect] Finalize error:", err)
    return false
  }
}

/** Delete the Smithery connection (best-effort) when a row is removed. */
export async function deleteSmitheryConnection(
  connectionId: string,
  apiKey: string
): Promise<void> {
  const smithery = getProvider(apiKey)
  await smithery.deleteConnection(connectionId)
}
