"use client"

import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { queryKeys } from "../keys"

export type TopUsersRange = "24h" | "7d" | "30d"

interface TopUser {
  name: string
  image?: string | null
  messageCount: number
  chatCount: number
}

interface TopUsersResponse {
  topUsers: TopUser[]
}

async function fetchTopUsers(range: TopUsersRange): Promise<TopUsersResponse> {
  const response = await fetch(`/api/admin/top-users?range=${range}`)
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error("Forbidden: Admin access required")
    }
    throw new Error("Failed to fetch top users")
  }
  return response.json()
}

export function useAdminTopUsersQuery(range: TopUsersRange = "30d") {
  const { status } = useSession()
  const isAuthenticated = status === "authenticated"

  return useQuery({
    queryKey: queryKeys.admin.topUsers(range),
    queryFn: () => fetchTopUsers(range),
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds
    retry: (failureCount, error) => {
      // Don't retry on 403 Forbidden
      if (error instanceof Error && error.message.includes("Forbidden")) {
        return false
      }
      return failureCount < 3
    },
  })
}
