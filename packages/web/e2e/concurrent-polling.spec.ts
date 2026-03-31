/**
 * End-to-end test for concurrent agent polling.
 *
 * Uses the REAL Next.js app, REAL Daytona sandboxes, REAL OpenCode agents,
 * REAL PostgreSQL database, and the REAL useExecutionPoller hook running
 * in a real browser.
 *
 * No GitHub, no OAuth, no GITHUB_PAT required.
 *
 * Exercises:
 *   - useExecutionPoller hook (real React, real browser fetch)
 *   - POST /api/agent/status (DB lease, sandbox polling, snapshot versioning)
 *   - POST /api/agent/execution/active (recovery after page refresh)
 *   - Concurrent polling of multiple agents
 *   - Page refresh → recovery flow
 *
 * Prerequisites:
 *   - Dev server running: npm run dev (in packages/web)
 *   - DAYTONA_API_KEY in environment or .env
 *   - NEXTAUTH_SECRET in environment or packages/web/.env
 *   - Database accessible
 *
 * Run:
 *   cd packages/web && npx playwright test
 */
import { test, expect } from "@playwright/test"

const AGENT_COUNT = 3

interface BranchInfo {
  branchId: string
  messageId: string
  sandboxId: string
  repoId: string
}

test.describe("concurrent agent polling (real sandboxes)", () => {
  let branches: BranchInfo[] = []

  test.afterAll(async ({ browser }) => {
    if (branches.length === 0) return
    const context = await browser.newContext({ baseURL: "http://localhost:3000" })
    try {
      await context.request.delete("/api/e2e/setup", {
        data: { sandboxIds: branches.map(b => b.sandboxId) },
      })
    } catch { /* best effort */ }
    await context.close()
  })

  test("multiple agents stream concurrently and recover after page refresh", async ({ page }) => {
    // 1. Setup: create test user, sandboxes, DB records, start agents
    //    Also sets the auth cookie so all subsequent requests work.
    const setupRes = await page.request.post("/api/e2e/setup", {
      data: { count: AGENT_COUNT },
    })
    expect(setupRes.ok()).toBe(true)
    const setupData = await setupRes.json()
    branches = setupData.branches
    expect(branches).toHaveLength(AGENT_COUNT)

    console.log("Setup complete:", branches.map(b => ({ branch: b.branchId, sandbox: b.sandboxId })))

    // 2. Navigate to test page — mounts real useExecutionPoller hooks.
    //    Branches are seeded with status=RUNNING and have active AgentExecutions,
    //    so the hook enters recovery mode and starts polling.
    const branchParam = branches.map(b => b.branchId).join(",")
    const sandboxParam = branches.map(b => b.sandboxId).join(",")
    await page.goto(`/e2e/polling?branches=${branchParam}&sandboxIds=${sandboxParam}`)

    // Wait for all panels to render
    await expect(page.getByTestId("panel-count")).toHaveText(String(AGENT_COUNT))

    // 3. Assert: all panels show "running" (hooks recovered the active executions)
    for (const b of branches) {
      await expect(page.getByTestId(`status-${b.branchId}`)).toHaveText("running", { timeout: 30_000 })
    }
    console.log("All panels running")

    // 4. Wait for content to start streaming on all panels
    for (const b of branches) {
      await expect(async () => {
        const len = await page.getByTestId(`content-length-${b.branchId}`).textContent()
        expect(Number(len)).toBeGreaterThan(0)
      }).toPass({ timeout: 60_000 })
    }
    console.log("All panels have content")

    // 5. Record content lengths before refresh
    const preLengths: Record<string, number> = {}
    for (const b of branches) {
      const len = await page.getByTestId(`content-length-${b.branchId}`).textContent()
      preLengths[b.branchId] = Number(len)
    }
    console.log("Content lengths before refresh:", preLengths)

    // 6. PAGE REFRESH — the core scenario.
    //    React unmounts, all hook state is lost, pollingBranches Set is cleared.
    //    On remount, hooks must re-enter recovery mode via /api/agent/execution/active.
    await page.reload()
    await expect(page.getByTestId("panel-count")).toHaveText(String(AGENT_COUNT))

    // 7. Assert: hooks recover — status goes back to running (or idle if already done)
    for (const b of branches) {
      await expect(async () => {
        const status = await page.getByTestId(`status-${b.branchId}`).textContent()
        expect(["running", "idle"]).toContain(status)
      }).toPass({ timeout: 30_000 })
    }
    console.log("All panels recovered after refresh")

    // 8. Wait for ALL agents to complete (status → idle)
    for (const b of branches) {
      await expect(page.getByTestId(`status-${b.branchId}`)).toHaveText("idle", { timeout: 3 * 60_000 })
    }
    console.log("All agents completed")

    // 9. Assert: all panels have content in the UI after completion.
    //    This verifies the bug fix: after refresh, the hook fetches final
    //    content from a completed execution before setting IDLE.
    for (const b of branches) {
      const finalLen = await page.getByTestId(`content-length-${b.branchId}`).textContent()
      expect(Number(finalLen)).toBeGreaterThan(0)
      console.log(`  Branch ${b.branchId}: final content length = ${finalLen}`)
    }

    // 10. Assert: hooks actually polled (not just a single render)
    for (const b of branches) {
      const polls = await page.getByTestId(`poll-count-${b.branchId}`).textContent()
      expect(Number(polls)).toBeGreaterThan(0)
    }
  })
})
