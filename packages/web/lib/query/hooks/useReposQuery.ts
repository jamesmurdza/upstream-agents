"use client"

import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { queryKeys } from "../keys"
import { fetchRepos, type GitHubRepo } from "@/lib/github"

/**
 * Fetches the list of GitHub repositories for the authenticated user.
 * Sorted by recently updated, includes owned, collaborator, and org repos.
 */
export function useReposQuery() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.github.repos(),
    queryFn: async (): Promise<GitHubRepo[]> => {
      if (!session?.accessToken) {
        throw new Error("No access token available")
      }
      return fetchRepos(session.accessToken)
    },
    enabled: !!session?.accessToken,
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}
