/**
 * End-to-end polling integration test.
 *
 * Validates the contract that useExecutionPoller (and the web status route)
 * relies on: incremental content delivery, completion detection, and session
 * reattachment after a simulated page refresh.
 *
 * Uses OpenCode (no provider API key needed — just DAYTONA_API_KEY).
 *
 * Required env vars:
 *   - DAYTONA_API_KEY
 *
 * Run:
 *   DAYTONA_API_KEY=... npm test -- tests/integration/polling-e2e.test.ts
 */
import "dotenv/config"
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { Daytona, type Sandbox } from "@daytonaio/sdk"
import {
  createBackgroundSession,
  getBackgroundSession,
  type BackgroundSession,
  type Event,
} from "../../src/index.js"

const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY

// Prompt that produces enough output to span multiple poll ticks
const PROMPT = "Write a short paragraph about each planet in our solar system. Include interesting facts."

/** Snapshot of accumulated state at a point in time — mirrors what the web
 *  status route builds from events and what the poller consumes. */
interface PollSnapshot {
  tokens: string
  toolStarts: number
  toolEnds: number
  ended: boolean
  crashed: boolean
  running: boolean
}

async function takeSnapshot(bg: BackgroundSession): Promise<PollSnapshot> {
  const { events } = await bg.getEvents()
  return summarizeEvents(events, await bg.isRunning())
}

function summarizeEvents(events: Event[], running: boolean): PollSnapshot {
  let tokens = ""
  let toolStarts = 0
  let toolEnds = 0
  let ended = false
  let crashed = false

  for (const e of events) {
    switch (e.type) {
      case "token":
        tokens += e.text
        break
      case "tool_start":
        toolStarts++
        break
      case "tool_end":
        toolEnds++
        break
      case "end":
        ended = true
        break
      case "agent_crashed":
        crashed = true
        break
    }
  }

  return { tokens, toolStarts, toolEnds, ended, crashed, running }
}

/** Poll in a loop, yielding snapshots at each tick — the same pattern
 *  useExecutionPoller uses against /api/agent/status. */
async function* pollSnapshots(
  bg: BackgroundSession,
  intervalMs = 500,
  timeoutMs = 120_000,
): AsyncGenerator<PollSnapshot> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const snap = await takeSnapshot(bg)
    yield snap
    if (snap.ended || snap.crashed) return
    if (!snap.running) return
    await new Promise(r => setTimeout(r, intervalMs))
  }
  throw new Error("pollSnapshots timed out")
}

describe.skipIf(!DAYTONA_API_KEY)(
  "polling e2e (real sandbox + opencode agent)",
  () => {
    let daytona: Daytona
    let sandbox: Sandbox

    beforeAll(async () => {
      daytona = new Daytona({ apiKey: DAYTONA_API_KEY! })
      sandbox = await daytona.create()
    }, 60_000)

    afterAll(async () => {
      if (sandbox) await sandbox.delete()
    }, 30_000)

    // ---------------------------------------------------------------
    // 1. Content streams incrementally (not just at the end)
    // ---------------------------------------------------------------
    it("delivers content incrementally while running", async () => {
      const bg = await createBackgroundSession("opencode", {
        sandbox: sandbox as any,
        timeout: 120,
      })

      await bg.start(PROMPT)

      const tokenLengths: number[] = []

      for await (const snap of pollSnapshots(bg, 1000)) {
        tokenLengths.push(snap.tokens.length)
        if (snap.ended || snap.crashed) break
      }

      // With a longer prompt we should see content grow across multiple
      // poll ticks. At minimum: some content arrived before the final tick.
      const distinct = new Set(tokenLengths)
      expect(distinct.size).toBeGreaterThan(1)

      const finalLen = tokenLengths[tokenLengths.length - 1]
      expect(finalLen).toBeGreaterThan(0)
    }, 180_000)

    // ---------------------------------------------------------------
    // 2. Completion is detected cleanly
    // ---------------------------------------------------------------
    it("detects completion with an end event", async () => {
      const bg = await createBackgroundSession("opencode", {
        sandbox: sandbox as any,
        timeout: 120,
      })

      await bg.start("What is 2+2? Reply with just the number.")

      let finalSnap: PollSnapshot | null = null
      for await (const snap of pollSnapshots(bg)) {
        finalSnap = snap
      }

      expect(finalSnap).not.toBeNull()
      expect(finalSnap!.ended).toBe(true)
      expect(finalSnap!.crashed).toBe(false)
      expect(finalSnap!.running).toBe(false)
      expect(finalSnap!.tokens).toContain("4")
    }, 180_000)

    // ---------------------------------------------------------------
    // 3. Reattach after "page refresh" — the key recovery scenario
    //    After reattach, the event cursor resets so tokens from before
    //    reattach aren't replayed. The contract the poller relies on is:
    //    isRunning() is accurate, and new tokens (if still running)
    //    continue to flow.
    // ---------------------------------------------------------------
    it("reattaches mid-stream and can poll to completion", async () => {
      const bg1 = await createBackgroundSession("opencode", {
        sandbox: sandbox as any,
        timeout: 120,
      })
      const sessionId = bg1.id

      await bg1.start(PROMPT)

      // Poll a few times to confirm content is flowing
      let earlyLen = 0
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 1500))
        const snap = await takeSnapshot(bg1)
        earlyLen = snap.tokens.length
        if (snap.ended) break
      }
      expect(earlyLen).toBeGreaterThan(0)

      // --- simulate page refresh: drop bg1, reattach from scratch ---
      const bg2 = await getBackgroundSession({
        sandbox: sandbox as any,
        backgroundSessionId: sessionId,
      })

      // Poll the reattached session to completion — this is exactly what
      // useExecutionPoller does after a page refresh.
      let finalSnap: PollSnapshot | null = null
      for await (const snap of pollSnapshots(bg2)) {
        finalSnap = snap
      }

      expect(finalSnap).not.toBeNull()
      // The key assertion: we can detect completion through the reattached handle
      expect(finalSnap!.ended || !finalSnap!.running).toBe(true)
    }, 180_000)

    // ---------------------------------------------------------------
    // 4. Reattach AFTER completion — process is no longer running
    // ---------------------------------------------------------------
    it("detects finished state when reattaching after completion", async () => {
      const bg1 = await createBackgroundSession("opencode", {
        sandbox: sandbox as any,
        timeout: 120,
      })
      const sessionId = bg1.id

      await bg1.start("What is 2+2? Reply with just the number.")

      // Wait for completion
      for await (const snap of pollSnapshots(bg1)) {
        if (snap.ended || !snap.running) break
      }

      // Reattach (simulates refresh after execution completed)
      const bg2 = await getBackgroundSession({
        sandbox: sandbox as any,
        backgroundSessionId: sessionId,
      })

      // The key contract: isRunning() returns false for a finished process.
      // This is how the poller and status route detect completion after refresh.
      expect(await bg2.isRunning()).toBe(false)
    }, 180_000)

    // ---------------------------------------------------------------
    // 5. Cancellation is reflected in the poll loop
    // ---------------------------------------------------------------
    it("reflects cancellation in poll results", async () => {
      const bg = await createBackgroundSession("opencode", {
        sandbox: sandbox as any,
        timeout: 120,
      })

      await bg.start("Write a very long essay about the history of computing.")

      // Let it run briefly
      await new Promise(r => setTimeout(r, 3000))
      expect(await bg.isRunning()).toBe(true)

      await bg.cancel()
      await new Promise(r => setTimeout(r, 2000))

      const snap = await takeSnapshot(bg)
      expect(snap.running).toBe(false)
      expect(snap.crashed).toBe(true)
    }, 60_000)

    // ---------------------------------------------------------------
    // 6. Monotonically increasing content (no regressions)
    // ---------------------------------------------------------------
    it("content length never decreases between polls", async () => {
      const bg = await createBackgroundSession("opencode", {
        sandbox: sandbox as any,
        timeout: 120,
      })

      await bg.start(PROMPT)

      let prevLen = 0
      for await (const snap of pollSnapshots(bg, 300)) {
        expect(snap.tokens.length).toBeGreaterThanOrEqual(prevLen)
        prevLen = snap.tokens.length
      }

      expect(prevLen).toBeGreaterThan(0)
    }, 180_000)
  },
)
