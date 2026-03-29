#!/usr/bin/env npx tsx
/**
 * Test that isRunning() works in a real sandbox: create background session,
 * start a turn, then verify isRunning is true while the agent runs and false after.
 * Uses the SDK's .done-file-only isRunning logic.
 *
 * Run: DAYTONA_API_KEY=... ANTHROPIC_API_KEY=... npx tsx scripts/test-is-running-sandbox.ts
 */
import "dotenv/config"
import { Daytona } from "@daytonaio/sdk"
import { createBackgroundSession } from "../src/index.js"

async function main() {
  if (!process.env.DAYTONA_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    console.error("DAYTONA_API_KEY and ANTHROPIC_API_KEY required")
    process.exit(1)
  }

  const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY })
  const sandbox = await daytona.create({
    envVars: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY },
  })

  try {
    const bg = await createBackgroundSession("claude", {
      sandbox: sandbox as any,
      timeout: 120,
    })
    console.log("Session ID:", bg.id)

    console.log("Starting turn...")
    const t0 = Date.now()
    const startResult = await bg.start("List the numbers 1 to 10, one per line, then say DONE.")
    const startMs = Date.now() - t0
    console.log("start() returned in", (startMs / 1000).toFixed(2), "s  pid:", startResult.pid, "outputFile:", startResult.outputFile)
    const pidFromGetPid = await bg.getPid()
    console.log("getPid() after start():", pidFromGetPid, pidFromGetPid === startResult.pid ? "✓" : "✗")
    const runningRightAfter = await bg.isRunning()
    console.log("isRunning() right after start():", runningRightAfter, runningRightAfter ? "✓" : "✗")

    // Wait for turn to complete: poll until we see an end event; print output file live
    const timeoutMs = 120_000
    const pollIntervalMs = 2000
    const deadline = Date.now() + timeoutMs
    let events: Awaited<ReturnType<typeof bg.getEvents>>["events"] = []
    let lastOutputLen = 0
    console.log("\n--- output (live) ---")
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, pollIntervalMs))
      try {
        const data = await sandbox.fs.downloadFile(startResult.outputFile)
        const output = (typeof data === "string" ? data : Buffer.isBuffer(data) ? data.toString("utf8") : new TextDecoder().decode(data as ArrayBuffer))
        if (output.length > lastOutputLen) {
          process.stdout.write(output.slice(lastOutputLen))
          lastOutputLen = output.length
        }
      } catch {
        // ignore read errors while still running
      }
      const res = await bg.getEvents()
      events = res.events
      const running = await bg.isRunning()
      const hasEnd = events.some((e) => e.type === "end")
      console.log(`\n  [${((Date.now() - t0) / 1000).toFixed(0)}s] isRunning=${running} events=${events.length} hasEnd=${hasEnd}`)
      for (const e of events) console.log("    event:", e.type, Object.keys(e).filter((k) => k !== "type").slice(0, 4).join(", "))
      if (hasEnd) break
    }
    console.log("\n--- end output ---")

    // Use events from the loop (we broke when we got end); a second getEvents() would see meta cleared and return []
    const finalEvents = events
    const hasEvents = finalEvents.length > 0
    const hasEndEvent = finalEvents.some((e) => e.type === "end")
    const pidAfterEnd = await bg.getPid()
    const runningAfter = await bg.isRunning()
    console.log("getPid() after turn ended:", pidAfterEnd, pidAfterEnd == null ? "✓ (null)" : "✗")

    console.log("\nResult:")
    console.log("  outputFile:", startResult.outputFile)
    console.log("  isRunning() false after turn ended:", !runningAfter ? "✓" : "✗")
    console.log("  getPid() matched start().pid:", pidFromGetPid === startResult.pid ? "✓" : "✗")
    console.log("  getPid() null after turn ended:", pidAfterEnd == null ? "✓" : "✗")
    console.log("  getEvents() returned events:", hasEvents ? "✓" : "✗")
    console.log("  saw end event:", hasEndEvent ? "✓" : "✗")

    let outputContents = ""
    try {
      const data = await sandbox.fs.downloadFile(startResult.outputFile)
      outputContents = (typeof data === "string"
        ? data
        : Buffer.isBuffer(data)
          ? data.toString("utf8")
          : new TextDecoder().decode(data as ArrayBuffer)
      ).trim()
    } catch (e) {
      outputContents = `(failed to read: ${e})`
    }
    if (outputContents && lastOutputLen === 0) console.log("\noutputFile contents:\n" + outputContents)
    else if (outputContents) console.log("\n(output above; total", outputContents.split("\n").length, "lines)")

    const ok = !runningAfter && hasEvents && hasEndEvent
    if (ok) {
      console.log("\nPass: isRunning / getEvents method works in sandbox.", runningRightAfter ? "(SSH adapter; start() was non-blocking.)" : "")
    } else {
      console.log("\nFail: expected turn to finish and events to be returned.")
      process.exit(1)
    }
  } finally {
    console.log("Deleting sandbox...")
    await sandbox.delete()
    console.log("Done.")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
