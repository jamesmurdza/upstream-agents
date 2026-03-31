/**
 * Quick test of foreground streaming and background execution.
 * Run with: DAYTONA_API_KEY=... TEST_ANTHROPIC_API_KEY=... npx ts-node tests/integration/test-all.ts
 */
import { Daytona } from "@daytonaio/sdk"
import { createSession, createBackgroundSession } from "../../dist/session.js"

const cleanEnv = (val: string) => val.replace(/[\r\n\s]/g, "")

async function main() {
  if (!process.env.DAYTONA_API_KEY || !process.env.TEST_ANTHROPIC_API_KEY) {
    console.log("Skipping: DAYTONA_API_KEY and TEST_ANTHROPIC_API_KEY required")
    process.exit(0)
  }

  const daytona = new Daytona({ apiKey: cleanEnv(process.env.DAYTONA_API_KEY) })
  const sandbox = await daytona.create()
  console.log(`Sandbox: ${sandbox.id}\n`)

  try {
    // Test 1: Foreground streaming
    console.log("=== Test 1: Foreground Streaming ===")
    const session = await createSession("claude", {
      sandbox,
      env: { ANTHROPIC_API_KEY: cleanEnv(process.env.TEST_ANTHROPIC_API_KEY) },
    })
    
    console.log("Running: Say hi in 5 words or less")
    let tokenCount = 0
    let hasEnd = false
    for await (const event of session.run("Say hi in 5 words or less")) {
      if (event.type === "token") {
        process.stdout.write(event.text)
        tokenCount++
      }
      if (event.type === "end") {
        hasEnd = true
        console.log("\n[END]")
      }
    }
    console.log(`Tokens: ${tokenCount}, hasEnd: ${hasEnd}`)
    
    if (!hasEnd) {
      console.log("❌ Foreground streaming failed - no end event")
      process.exit(1)
    }
    console.log("✅ Foreground streaming works!\n")

    // Test 2: Background execution
    console.log("=== Test 2: Background Execution ===")
    const bgSession = await createBackgroundSession("claude", {
      sandbox,
      env: { ANTHROPIC_API_KEY: cleanEnv(process.env.TEST_ANTHROPIC_API_KEY) },
    })
    
    const { pid } = await bgSession.start("Count from 1 to 3")
    console.log(`Started with PID: ${pid}`)
    
    let bgTokens = 0
    let bgHasEnd = false
    for (let i = 0; i < 30; i++) {
      const { events, running } = await bgSession.getEvents()
      for (const event of events) {
        if (event.type === "token") {
          process.stdout.write(event.text)
          bgTokens++
        }
        if (event.type === "end") {
          bgHasEnd = true
          console.log("\n[END]")
        }
      }
      if (!running) break
      await new Promise(r => setTimeout(r, 500))
    }
    console.log(`Tokens: ${bgTokens}, hasEnd: ${bgHasEnd}`)
    
    if (!bgHasEnd) {
      console.log("❌ Background execution failed - no end event")
      process.exit(1)
    }
    console.log("✅ Background execution works!\n")

    console.log("=== All tests passed! ===")
  } finally {
    console.log("Cleaning up...")
    await sandbox.delete()
  }
}

main().catch(e => {
  console.error("Test failed:", e)
  process.exit(1)
})
