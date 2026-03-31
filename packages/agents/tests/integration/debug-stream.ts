/**
 * Debug foreground streaming
 */
import { Daytona } from "@daytonaio/sdk"

const cleanEnv = (val: string) => val.replace(/[\r\n\s]/g, "")

async function main() {
  const daytona = new Daytona({ apiKey: cleanEnv(process.env.DAYTONA_API_KEY!) })
  const sandbox = await daytona.create()
  console.log("Sandbox:", sandbox.id)

  try {
    // First install claude
    console.log("Installing claude CLI...")
    const installResult = await sandbox.process.executeCommand("npm install -g @anthropic-ai/claude-code", undefined, undefined, 120)
    console.log("Install exit code:", installResult.exitCode)

    // Test the raw API
    const sessionId = "test-" + Date.now()
    await sandbox.process.createSession(sessionId)
    console.log("Created session:", sessionId)

    const env = { ANTHROPIC_API_KEY: cleanEnv(process.env.TEST_ANTHROPIC_API_KEY!) }
    const envExports = Object.entries(env).map(([k, v]) => "export " + k + "='" + v + "'").join("; ")
    const command = envExports + "; claude --output-format stream-json --verbose -p 'Say hi'"
    console.log("Command:", command.slice(0, 120) + "...")

    console.log("\nStarting command with runAsync: true...")
    const { cmdId } = await sandbox.process.executeSessionCommand(sessionId, {
      command,
      runAsync: true,
    })
    console.log("Command ID:", cmdId)

    console.log("\nStreaming logs (with callbacks)...")
    let chunks = 0
    const streamStart = Date.now()
    await sandbox.process.getSessionCommandLogs(
      sessionId,
      cmdId,
      (stdout) => {
        chunks++
        console.log("[stdout " + chunks + " at " + (Date.now() - streamStart) + "ms]:", stdout.slice(0, 200))
      },
      (stderr) => {
        console.log("[stderr at " + (Date.now() - streamStart) + "ms]:", stderr.slice(0, 200))
      }
    )
    console.log("Streaming done after " + (Date.now() - streamStart) + "ms, total chunks:", chunks)

    // Get final logs
    console.log("\nGetting final logs...")
    const logs = await sandbox.process.getSessionCommandLogs(sessionId, cmdId)
    console.log("Final stdout length:", logs.stdout?.length ?? 0)
    console.log("Final stderr length:", logs.stderr?.length ?? 0)
    if (logs.stdout) {
      console.log("=== STDOUT ===")
      console.log(logs.stdout.slice(0, 1500))
    }
    if (logs.stderr) {
      console.log("=== STDERR ===")
      console.log(logs.stderr.slice(0, 500))
    }

  } finally {
    await sandbox.delete()
  }
}

main().catch(e => {
  console.error("Error:", e)
  process.exit(1)
})
