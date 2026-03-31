/**
 * Regression test: agent completes on the active branch but content stays
 * "Thinking..." because cross-device sync overwrites branch.status to "idle"
 * before the poller delivers the final content.
 *
 * This test stays on ONE branch the entire time (no switching) to isolate
 * the sync-vs-poller race condition.
 *
 * Run:
 *   cd packages/web && npx playwright test e2e/active-branch-stuck.spec.ts
 */
import { test, expect } from "@playwright/test"

const PROMPT = "Create a file called race.txt with 'sync race test'. Reply ONLY 'Done'."

interface BranchInfo {
  branchId: string
  sandboxId: string
  repoName: string
}

test.describe("active branch: no Thinking... after completion", () => {
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

  test("content replaces Thinking on the active branch after agent completes", async ({ page }) => {
    // ── 1. Setup ──
    const setupRes = await page.request.post("/api/e2e/setup", {
      data: { count: 1 },
    })
    expect(setupRes.ok()).toBe(true)
    branches = (await setupRes.json()).branches
    const { repoName } = branches[0]

    // ── 2. Navigate and select branch ──
    await page.goto(`/repo/e2e-test/${repoName}`)
    await expect(page.locator("main")).not.toContainText("Redirecting to login", { timeout: 10_000 })
    const branchBtn = page.getByRole("button", { name: /e2e-branch-0/ })
    await expect(branchBtn).toBeVisible({ timeout: 15_000 })
    await branchBtn.click()

    const textarea = page.locator("textarea")
    await expect(textarea).toBeVisible({ timeout: 10_000 })

    // ── 3. Send message and STAY on this branch ──
    await textarea.fill(PROMPT)
    await textarea.press("Enter")
    console.log("Message sent")

    // ── 4. "Agent is working..." should appear ──
    await expect(page.getByText("Agent is working...")).toBeVisible({ timeout: 30_000 })
    console.log("Agent working")

    // ── 5. "Thinking..." may briefly appear — that's OK ──
    // But it MUST eventually be replaced by real content.

    // ── 6. Wait for agent to complete (working indicator gone) ──
    await expect(page.getByText("Agent is working...")).toBeHidden({ timeout: 3 * 60_000 })
    console.log("Agent completed")

    // ── 7. THE KEY ASSERTION: "Thinking..." must NOT be visible ──
    // Give a moment for any final renders
    await page.waitForTimeout(2_000)

    const thinkingVisible = await page.locator("text=Thinking...").isVisible().catch(() => false)
    if (thinkingVisible) {
      console.error("BUG: 'Thinking...' is still visible after agent completed!")
    }
    expect(thinkingVisible).toBe(false)

    // ── 8. Real content must be visible ──
    const prose = page.locator('[class*="prose"]')
    await expect(prose).toBeVisible({ timeout: 5_000 })
    const content = await prose.last().textContent()
    console.log("Final content:", content?.slice(0, 80))
    expect(content?.length).toBeGreaterThan(0)

    console.log("Active branch assertion passed — pausing 5s")
    await page.waitForTimeout(1_500)
  })
})
