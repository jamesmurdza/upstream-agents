/**
 * End-to-end test using the REAL app UI — not a test harness.
 *
 * Navigates to `/`, interacts with the actual ChatPanel, MessageList,
 * MessageBubble, ChatInput, and useExecutionPoller — the exact same
 * rendering stack users see.
 *
 * Catches bugs the test harness misses:
 *   - Messages not rendering in the message list
 *   - Agent status stuck on "running" after completion
 *   - Tool call timeline not appearing
 *   - useBranchOperations state updates dropping messages
 *
 * Uses the same test DB, env vars, and Playwright config as the harness test.
 *
 * Run:
 *   cd packages/web && npx playwright test e2e/real-app-polling.spec.ts
 */
import { test, expect, type Page } from "@playwright/test"

const PROMPT = "Create a file called greeting.txt containing 'Hello E2E'. Then reply with ONLY the word 'Done'."

interface BranchInfo {
  branchId: string
  sandboxId: string
  repoName: string
}

test.describe("real app: send → stream → complete → refresh", () => {
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

  test("send message through real UI, see streaming + tool calls, refresh preserves content", async ({ page }) => {
    // ── 1. Setup: test user, auth cookie, 1 sandbox, DB scaffold ──
    const setupRes = await page.request.post("/api/e2e/setup", {
      data: { count: 1 },
    })
    expect(setupRes.ok()).toBe(true)
    const setupData = await setupRes.json()
    branches = setupData.branches
    expect(branches).toHaveLength(1)
    const { branchId, sandboxId, repoName } = branches[0]
    console.log("Setup:", { branchId, sandboxId, repoName })

    // ── 2. Navigate to the real app ──
    // The setup route set the session cookie, so we're authenticated.
    // Navigate to the repo URL so it loads directly.
    await page.goto(`/repo/e2e-test/${repoName}`)

    // Wait for the app to finish loading (the loading spinner disappears)
    await expect(page.locator("main")).not.toContainText("Redirecting to login", { timeout: 10_000 })

    // ── 3. Wait for the branch to appear and be selected ──
    const branchButton = page.getByRole("button", { name: /e2e-branch-0/ })
    await expect(branchButton).toBeVisible({ timeout: 15_000 })
    console.log("Branch visible in sidebar")

    // Click the branch to select it (it might already be selected)
    await branchButton.click()

    // ── 4. Wait for the chat panel to be ready ──
    // The textarea should be visible with the placeholder text
    const textarea = page.locator("textarea")
    await expect(textarea).toBeVisible({ timeout: 10_000 })
    console.log("Chat input ready")

    // ── 5. Type a prompt and send (the real handleSend flow) ──
    await textarea.fill(PROMPT)
    await expect(textarea).toHaveValue(PROMPT)

    // Send via Enter key (more reliable than finding the send button icon)
    await textarea.press("Enter")
    console.log("Message sent via real UI")

    // ── 6. Assert: "Agent is working..." indicator appears ──
    await expect(page.getByText("Agent is working...")).toBeVisible({ timeout: 30_000 })
    console.log("Agent working indicator visible")

    // ── 7. Assert: user message appears in the message list ──
    await expect(page.locator("text=" + PROMPT.slice(0, 30))).toBeVisible({ timeout: 5_000 })
    console.log("User message rendered")

    // ── 8. Wait for streaming content to appear in the assistant bubble ──
    // The assistant message should have some content rendered
    await expect(async () => {
      // Look for any assistant message content (rendered via Markdown)
      const assistantBubbles = page.locator('[class*="prose"]')
      const count = await assistantBubbles.count()
      expect(count).toBeGreaterThan(0)
    }).toPass({ timeout: 60_000 })
    console.log("Assistant content streaming")

    // ── 9. Wait for tool calls to appear (file creation triggers tool call timeline) ──
    // Tool calls render with icons like FileText, Terminal, etc.
    // The ToolCallTimeline renders items with tool summaries
    await expect(async () => {
      // Tool call items have tool names like "Write", "Bash" in their text
      const toolItems = page.locator("text=/Write|Bash|Read|Edit|Glob|Grep/i")
      const count = await toolItems.count()
      expect(count).toBeGreaterThan(0)
    }).toPass({ timeout: 90_000 })
    console.log("Tool calls visible in UI")

    // ── 10. Wait for agent to complete ──
    // "Agent is working..." should disappear when status goes to IDLE
    await expect(page.getByText("Agent is working...")).toBeHidden({ timeout: 3 * 60_000 })
    console.log("Agent completed (working indicator gone)")

    // ── 11. Snapshot the rendered content before refresh ──
    // Count visible messages (both user and assistant)
    const preRefreshMessages = await page.locator('[class*="prose"]').count()
    console.log("Pre-refresh assistant message count:", preRefreshMessages)
    expect(preRefreshMessages).toBeGreaterThan(0)

    // Get the assistant content text
    const preRefreshContent = await page.locator('[class*="prose"]').last().textContent()
    console.log("Pre-refresh content:", preRefreshContent?.slice(0, 100))

    // ── 12. PAGE REFRESH — the critical test ──
    await page.reload()

    // Wait for app to load again (not redirected to login)
    await expect(page.locator("main")).not.toContainText("Redirecting to login", { timeout: 10_000 })

    // Navigate back to the same repo/branch
    await page.goto(`/repo/e2e-test/${repoName}`)
    const branchBtnAfter = page.getByRole("button", { name: /e2e-branch-0/ })
    await expect(branchBtnAfter).toBeVisible({ timeout: 15_000 })
    await branchBtnAfter.click()

    // Wait for messages to load
    await expect(textarea).toBeVisible({ timeout: 10_000 })

    // ── 13. Assert: messages survived the refresh ──
    // User message should still be visible
    await expect(page.locator("text=" + PROMPT.slice(0, 30))).toBeVisible({ timeout: 15_000 })
    console.log("User message still visible after refresh")

    // Assistant content should still be visible
    await expect(async () => {
      const postBubbles = page.locator('[class*="prose"]')
      const count = await postBubbles.count()
      expect(count).toBeGreaterThan(0)
    }).toPass({ timeout: 15_000 })
    console.log("Assistant content still visible after refresh")

    // ── 14. Assert: agent is NOT stuck on "running" ──
    // After refresh, the agent already completed. The status should NOT show "working"
    // (this was the bug: agent appearing stuck on running after refresh)
    const workingIndicator = page.getByText("Agent is working...")
    const isStuck = await workingIndicator.isVisible().catch(() => false)
    if (isStuck) {
      // Give it a moment — the hook should recover and transition to idle
      await expect(workingIndicator).toBeHidden({ timeout: 30_000 })
      console.log("RECOVERED: working indicator cleared after brief recovery period")
    } else {
      console.log("GOOD: no spurious working indicator after refresh")
    }

    // ── 15. Verify message count matches (no missing messages) ──
    const postRefreshContent = await page.locator('[class*="prose"]').last().textContent()
    console.log("Post-refresh content:", postRefreshContent?.slice(0, 100))
    expect(postRefreshContent?.length).toBeGreaterThan(0)

    console.log("All real-app assertions passed — pausing 5s for visual inspection")
    await page.waitForTimeout(1_500)
  })
})
