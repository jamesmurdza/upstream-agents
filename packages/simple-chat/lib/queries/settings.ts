"use client"

/**
 * TanStack Query hooks for user settings
 *
 * Provides cached access to user settings and credential flags.
 */

import { useQuery } from "@tanstack/react-query"
import { useSession } from "next-auth/react"
import { settingsKeys } from "./keys"
import { fetchSettings } from "@/lib/sync/api"
import type { Settings } from "@/lib/types"
import type { CredentialFlags } from "@/lib/credentials"
import { DEFAULT_SETTINGS } from "@/lib/storage"

/**
 * Settings query result
 */
export interface SettingsData {
  settings: Settings
  credentialFlags: CredentialFlags
}

/**
 * Hook to fetch user settings and credential flags
 *
 * Returns default settings when not authenticated.
 * Enabled only when authenticated.
 */
export function useSettingsQuery() {
  const { data: session, status } = useSession()

  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: async (): Promise<SettingsData> => {
      const response = await fetchSettings()
      return {
        settings: response.settings,
        credentialFlags: response.credentialFlags,
      }
    },
    enabled: status === "authenticated" && !!session?.user?.id,
    // Provide default data for unauthenticated users
    placeholderData: {
      settings: DEFAULT_SETTINGS,
      credentialFlags: {},
    },
  })
}

/**
 * Hook to get just the settings portion
 *
 * Falls back to defaults if not loaded.
 */
export function useSettings() {
  const { data } = useSettingsQuery()
  return data?.settings ?? DEFAULT_SETTINGS
}

/**
 * Hook to get just the credential flags
 *
 * Falls back to empty object if not loaded.
 */
export function useCredentialFlags() {
  const { data } = useSettingsQuery()
  return data?.credentialFlags ?? {}
}
