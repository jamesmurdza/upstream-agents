/**
 * End-to-end test: multiple agents running in parallel through the REAL app UI.
 *
 * Creates 3 branches under one repo, sends a message on each by switching
 * branches in the sidebar, then verifies all 3 complete with content.
 * Tests the exact same rendering stack users see when running concurrent agents.
 *
 * Run:
 *   cd packages/web && npx playwright test e2e/real-app-multi-agent.spec.ts
 */
import { test, expect } from "@playwright/test"

const AGENT_COUNT = 3

const PROMPTS = [
  "Create a file called hello0.txt with 'Hello from branch 0'. Reply ONLY 'Done 0'.",
  "Create a file called hello1.txt with 'Hello from branch 1'. Reply ONLY 'Done 1'.",
  "Create a file called hello2.txt with 'Hello from branch 2'. Reply ONLY 'Done 2'.",
]

interface BranchInfo {
  branchId: string
  sandboxId: string
  repoName: string
}

test.describe("real app: multiple concurrent agents", () => {
  let branches: BranchInfo[] = []

  test.afterAll(async ({ browser }) => {
    if (branches.length === 0) return
    const context = await browser.newContext({ baseURL: "http://localhost:3001" })
    try {
      await context.request.delete("/api/e2e/setup", {
        data: { sandboxIds: branches.map(b => b.sandboxId) },
      })
    } catch { /* best effort */ }
    await context.close()
  })

  test("send on 3 branches, all stream concurrently, all complete", async ({ page }) => {
    // ── 1. Setup: 3 branches under ONE repo ──
    const setupRes = await page.request.post("/api/e2e/setup", {
      data: { count: AGENT_COUNT, singleRepo: true },
    })
    expect(setupRes.ok()).toBe(true)
    const setupData = await setupRes.json()
    branches = setupData.branches
    expect(branches).toHaveLength(AGENT_COUNT)
    const repoName = branches[0].repoName
    console.log("Setup:", { repoName, branches: branches.map(b => b.branchId) })

    // ── 2. Navigate to the repo ──
    await page.goto(`/repo/e2e-test/${repoName}`)
    await expect(page.locator("main")).not.toContainText("Redirecting to login", { timeout: 10_000 })

    // Wait for all 3 branches to appear in sidebar
    for (let i = 0; i < AGENT_COUNT; i++) {
      await expect(page.getByRole("button", { name: new RegExp(`e2e-branch-${i}`) })).toBeVisible({ timeout: 15_000 })
    }
    console.log("All branches visible in sidebar")

    // ── 3. Send a message on each branch ──
    for (let i = 0; i < AGENT_COUNT; i++) {
      // Select branch
      await page.getByRole("button", { name: new RegExp(`e2e-branch-${i}`) }).click()

      // Wait for textarea
      const textarea = page.locator("textarea")
      await expect(textarea).toBeVisible({ timeout: 10_000 })

      // Wait for chat to be ready (empty state or messages loaded)
      await page.waitForTimeout(500)

      // Type and send
      await textarea.fill(PROMPTS[i])
      await textarea.press("Enter")
      console.log(`Sent message on branch ${i}`)

      // Wait briefly for the send to register before switching
      await expect(page.getByText("Agent is working...")).toBeVisible({ timeout: 15_000 })
    }
    console.log("All messages sent")

    // ── 4. Verify all agents are running ──
    // Check each branch shows a running indicator (the status dot in the sidebar
    // pulses for running branches). We can verify by switching to each and seeing
    // the working indicator.
    for (let i = 0; i < AGENT_COUNT; i++) {
      await page.getByRole("button", { name: new RegExp(`e2e-branch-${i}`) }).click()
      // Either still running or already done
      await expect(async () => {
        const working = await page.getByText("Agent is working...").isVisible().catch(() => false)
        const hasProse = await page.locator('[class*="prose"]').count()
        expect(working || hasProse > 0).toBe(true)
      }).toPass({ timeout: 30_000 })
    }
    console.log("All agents confirmed active")

    // ── 5. Wait for ALL agents to complete ──
    // Poll the API for completion status (faster than switching branches in UI)
    for (const b of branches) {
      await expect(async () => {
        const res = await page.request.post("/api/agent/execution/active", {
          data: { branchId: b.branchId },
        })
        const data = await res.json()
        expect(data.execution?.status).toMatch(/completed|error/)
      }).toPass({ timeout: 3 * 60_000 })
    }
    console.log("All agents completed (verified via API)")

    // ── 6. Visit each branch and verify content is rendered ──
    for (let i = 0; i < AGENT_COUNT; i++) {
      await page.getByRole("button", { name: new RegExp(`e2e-branch-${i}`) }).click()

      // Wait for messages to load
      await page.waitForTimeout(1000)

      // User message should be visible
      await expect(page.locator(`text=${PROMPTS[i].slice(0, 20)}`)).toBeVisible({ timeout: 10_000 })

      // Assistant content should be visible
      await expect(async () => {
        const prose = page.locator('[class*="prose"]')
        expect(await prose.count()).toBeGreaterThan(0)
      }).toPass({ timeout: 10_000 })

      // Should NOT show "Agent is working..."
      const working = await page.getByText("Agent is working...").isVisible().catch(() => false)
      expect(working).toBe(false)

      const content = await page.locator('[class*="prose"]').last().textContent()
      console.log(`Branch ${i}: content = "${content?.slice(0, 50)}"`)
    }

    // ── 7. PAGE REFRESH — verify all branches survive ──
    await page.reload()
    await page.goto(`/repo/e2e-test/${repoName}`)

    for (let i = 0; i < AGENT_COUNT; i++) {
      const branchBtn = page.getByRole("button", { name: new RegExp(`e2e-branch-${i}`) })
      await expect(branchBtn).toBeVisible({ timeout: 15_000 })
      await branchBtn.click()
      await page.waitForTimeout(1000)

      // Content should still be there
      await expect(async () => {
        const prose = page.locator('[class*="prose"]')
        expect(await prose.count()).toBeGreaterThan(0)
      }).toPass({ timeout: 10_000 })

      // Not stuck on running
      const stuck = await page.getByText("Agent is working...").isVisible().catch(() => false)
      expect(stuck).toBe(false)

      console.log(`Branch ${i}: content preserved after refresh`)
    }

    console.log("All real-app multi-agent assertions passed — pausing 5s for visual inspection")
    await page.waitForTimeout(1_500)
  })
})
