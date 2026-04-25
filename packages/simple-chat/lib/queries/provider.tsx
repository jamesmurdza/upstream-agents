"use client"

/**
 * TanStack Query Provider
 *
 * Provides QueryClient to the app with optimized defaults for SSE-based updates:
 * - staleTime: 30s - chat list isn't real-time critical; SSE handles live data
 * - refetchOnWindowFocus: false - don't fight the SSE stream for liveness
 * - retry: 1 - single retry for network hiccups
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useState } from "react"

interface QueryProviderProps {
  children: React.ReactNode
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Chat list isn't real-time critical; SSE handles live data
        staleTime: 30 * 1000,
        // Don't fight the SSE stream for liveness
        refetchOnWindowFocus: false,
        // Single retry for network hiccups
        retry: 1,
        // Don't refetch on mount if data exists
        refetchOnMount: false,
      },
    },
  })
}

// For SSR, we need to ensure we create a new client per request
let browserQueryClient: QueryClient | undefined = undefined

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always create a new client
    return makeQueryClient()
  } else {
    // Browser: reuse the same client
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
  }
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Using useState to ensure we only create the client once per component lifecycle
  const [queryClient] = useState(getQueryClient)

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}

/** Export queryClient getter for use outside React components (e.g., mutations) */
export { getQueryClient }
