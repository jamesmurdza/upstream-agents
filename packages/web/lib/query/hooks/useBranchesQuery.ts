"use client"

import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { queryKeys } from "../keys"
import { fetchBranches, type GitHubBranch } from "@/lib/github"

/**
 * Fetches branches for a specific GitHub repository.
 *
 * @param owner - Repository owner (username or org)
 * @param repo - Repository name
 */
export function useBranchesQuery(owner: string, repo: string) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: queryKeys.github.branches(owner, repo),
    queryFn: async (): Promise<GitHubBranch[]> => {
      if (!session?.accessToken) {
        throw new Error("No access token available")
      }
      return fetchBranches(session.accessToken, owner, repo)
    },
    enabled: !!session?.accessToken && !!owner && !!repo,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Fetches branches for a repo given as "owner/name" string
 */
export function useBranchesQueryFromFullName(fullName: string | null | undefined) {
  const parts = fullName?.split("/") ?? []
  const owner = parts[0] ?? ""
  const repo = parts[1] ?? ""

  return useBranchesQuery(owner, repo)
}
