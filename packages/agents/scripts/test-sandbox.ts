#!/usr/bin/env npx tsx
/**
 * Integration test using Daytona sandbox
 */
import { Daytona } from "@daytonaio/sdk"
import { createProvider } from "../src/index.js"

const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!DAYTONA_API_KEY || !ANTHROPIC_API_KEY) {
  console.error("Required environment variables: DAYTONA_API_KEY, ANTHROPIC_API_KEY")
  process.exit(1)
}

async function main() {
  console.log("=".repeat(60))
  console.log("Coding Agents SDK - Sandbox Integration Test")
  console.log("=".repeat(60))
  console.log()

  console.log("1. Creating Daytona sandbox...")
  const daytona = new Daytona({ apiKey: DAYTONA_API_KEY })
  const sandbox = await daytona.create({
    envVars: { ANTHROPIC_API_KEY: ANTHROPIC_API_KEY },
  })

  try {
    console.log("   ✓ Sandbox created successfully")
    console.log()

    console.log("2. Creating Claude provider with sandbox...")
    const provider = createProvider("claude", { sandbox, env: { ANTHROPIC_API_KEY: ANTHROPIC_API_KEY } })
    console.log("   ✓ Provider created")
    console.log()

    // Step 3: Run a simple prompt
    console.log("3. Running prompt: \"Say 'Hello from the sandbox!' and nothing else.\"")
    console.log("-".repeat(60))
    console.log()

    let hasResponse = false
    for await (const event of provider.run({
      prompt: "Say 'Hello from the sandbox!' and nothing else.",
    })) {
      if (event.type === "session") {
        console.log(`[Session: ${event.id}]`)
      } else if (event.type === "token") {
        process.stdout.write(event.text)
        hasResponse = true
      } else if (event.type === "end") {
        console.log()
        console.log()
        console.log("[End]")
      }
    }

    console.log()
    console.log("-".repeat(60))

    if (hasResponse) {
      console.log("   ✓ Received response from Claude")
    } else {
      console.log("   ✗ No response received")
    }

  } catch (error) {
    console.error("Error:", error)
    throw error
  } finally {
    // Step 4: Cleanup
    console.log()
    console.log("4. Destroying sandbox...")
    await sandbox.delete()
    console.log("   ✓ Sandbox destroyed")
    console.log()
    console.log("=".repeat(60))
    console.log("Test completed!")
    console.log("=".repeat(60))
  }
}

main().catch((error) => {
  console.error("Test failed:", error)
  process.exit(1)
})
