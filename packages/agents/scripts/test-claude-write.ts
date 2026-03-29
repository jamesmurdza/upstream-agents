#!/usr/bin/env npx tsx
/**
 * Test Claude's write file tool call output
 */
import { Daytona } from "@daytonaio/sdk"
import { createProvider } from "../src/index.js"

const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

async function main() {
  console.log("=== Claude Write File Tool Test ===\n")

  const daytona = new Daytona({ apiKey: DAYTONA_API_KEY })
  const sandbox = await daytona.create({
    envVars: { ANTHROPIC_API_KEY },
  })
  console.log("Sandbox created\n")

  try {
    const provider = createProvider("claude", { sandbox, env: { ANTHROPIC_API_KEY } })

    let toolOutput = ""
    let currentToolName = ""

    for await (const event of provider.run({
      prompt: "Write a file called /tmp/hello.txt with the content 'Hello World'. Just write the file, nothing else.",
    })) {
      switch (event.type) {
        case "session":
          console.log(`[SESSION] ${event.id}`)
          break
        case "token":
          process.stdout.write(event.text)
          break
        case "tool_start":
          currentToolName = event.name
          console.log(`\n>>> TOOL_START: "${event.name}"`)
          toolOutput = ""
          break
        case "tool_delta":
          toolOutput += event.text
          break
        case "tool_end":
          console.log(`>>> TOOL_END`)
          console.log(`>>> TOOL NAME: "${currentToolName}"`)
          console.log(`>>> RAW TOOL CONTENT:`)
          console.log("---BEGIN---")
          console.log(toolOutput)
          console.log("---END---")
          break
        case "end":
          console.log(`\n[END]`)
          break
      }
    }
  } finally {
    await sandbox.delete()
    console.log("Sandbox destroyed")
  }
}

main().catch(console.error)
