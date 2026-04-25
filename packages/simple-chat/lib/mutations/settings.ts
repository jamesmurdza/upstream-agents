"use client"

/**
 * TanStack Mutation for User Settings
 *
 * Handles updating user settings and credentials with optimistic updates.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { settingsKeys } from "@/lib/queries/keys"
import { updateSettings as apiUpdateSettings } from "@/lib/sync/api"
import type { SettingsData } from "@/lib/queries/settings"
import type { Settings } from "@/lib/types"
import type { Credentials } from "@/lib/credentials"

// =============================================================================
// Update Settings Mutation
// =============================================================================

interface UpdateSettingsParams {
  settings?: Partial<Settings>
  credentials?: Credentials
}

interface UpdateSettingsContext {
  previousSettings?: SettingsData
}

interface UpdateSettingsResult {
  ok: boolean
  error?: string
}

/**
 * Mutation to update user settings and/or credentials
 *
 * Performs optimistic updates for settings (not credentials, since
 * we only see credential flags, not values).
 *
 * Returns { ok, error } for compatibility with existing SettingsModal interface.
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient()

  return useMutation<UpdateSettingsResult, Error, UpdateSettingsParams, UpdateSettingsContext>({
    mutationFn: async (params) => {
      try {
        const response = await apiUpdateSettings(params)

        // Update cache with server response
        queryClient.setQueryData<SettingsData>(settingsKeys.all, {
          settings: response.settings,
          credentialFlags: response.credentialFlags,
        })

        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Failed to save settings",
        }
      }
    },
    onMutate: async ({ settings }) => {
      // Only optimistically update settings (not credentials)
      if (!settings) return {}

      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: settingsKeys.all })

      // Snapshot previous value
      const previousSettings = queryClient.getQueryData<SettingsData>(settingsKeys.all)

      // Optimistically update settings
      if (previousSettings) {
        queryClient.setQueryData<SettingsData>(settingsKeys.all, {
          ...previousSettings,
          settings: {
            ...previousSettings.settings,
            ...settings,
          },
        })
      }

      return { previousSettings }
    },
    onError: (_error, _params, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData<SettingsData>(settingsKeys.all, context.previousSettings)
      }
    },
  })
}
