/**
 * Playwright helpers to capture `/api/agent/*` request/response lines for debugging flaky streams.
 *
 * CI/local: `npm run test:e2e -- e2e/diagnostics/`
 */
import type { Page, TestInfo } from "@playwright/test"

const AGENT_API = /\/api\/agent\//

export interface StreamInstrumentation {
  /** Lines from network listener (method url -> status) */
  networkLines: string[]
  /** Call from test.afterEach or at end of test to attach as file */
  attachToTest: (testInfo: TestInfo) => Promise<void>
}

/**
 * Forward agent API response statuses to stdout. Does not read response bodies (avoids blocking the page).
 */
export function attachStreamInstrumentation(page: Page): StreamInstrumentation {
  const networkLines: string[] = []

  page.on("response", (res) => {
    const url = res.url()
    if (!AGENT_API.test(url)) return
    const req = res.request()
    const line = `[network] ${req.method()} ${url.split("?")[0]} -> ${res.status()}`
    networkLines.push(line)
    console.log(line)
  })

  return {
    networkLines,
    attachToTest: async (testInfo: TestInfo) => {
      const blob = ["=== network /api/agent/* ===", ...networkLines].join("\n")
      await testInfo.attach("stream-instrumentation.txt", {
        body: blob,
        contentType: "text/plain",
      })
    },
  }
}
