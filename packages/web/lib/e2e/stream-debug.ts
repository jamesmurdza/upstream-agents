/**
 * Opt-in debug logging for diagnosing agent stream / polling issues in dev and Playwright.
 * Enable with NEXT_PUBLIC_E2E_STREAM_DEBUG=1 (set in packages/web env or Playwright webServer).
 */
export const STREAM_DEBUG_PREFIX = "[stream-debug]"

export function streamDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_E2E_STREAM_DEBUG === "1"
}

export function streamDebug(...args: unknown[]): void {
  if (!streamDebugEnabled()) return
  console.log(STREAM_DEBUG_PREFIX, ...args)
}
