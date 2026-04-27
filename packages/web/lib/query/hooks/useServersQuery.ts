"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "../keys"

export interface ServerInfo {
  port: number
  url: string
}

/**
 * Polls for listening dev servers in a sandbox.
 * Automatically refreshes every 5 seconds while enabled.
 *
 * @param sandboxId - The sandbox to poll for servers
 * @param previewUrlPattern - URL pattern with {port} placeholder
 */
export function useServersQuery(
  sandboxId: string | null | undefined,
  previewUrlPattern?: string | null
) {
  return useQuery({
    queryKey: queryKeys.sandbox.servers(sandboxId ?? ""),
    queryFn: async (): Promise<ServerInfo[]> => {
      if (!sandboxId) return []

      const res = await fetch("/api/sandbox/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sandboxId, action: "list-servers" }),
      })

      if (!res.ok) {
        // Don't throw on polling failures - just return empty
        console.warn("Failed to fetch servers:", res.status)
        return []
      }

      const data = await res.json()
      const ports: number[] = Array.isArray(data.ports) ? data.ports : []

      return ports.map((port) => ({
        port,
        url: previewUrlPattern
          ? previewUrlPattern.replace("{port}", String(port))
          : `http://localhost:${port}`,
      }))
    },
    enabled: !!sandboxId,
    refetchInterval: 5000, // Poll every 5 seconds
    staleTime: 4000, // Consider stale after 4 seconds
    retry: false, // Don't retry polling failures
    refetchOnWindowFocus: false,
  })
}
