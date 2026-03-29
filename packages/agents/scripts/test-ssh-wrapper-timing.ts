#!/usr/bin/env npx tsx
/**
 * Run different commands over Daytona SSH to see what makes exec() slow.
 * Usage: DAYTONA_API_KEY=... npx tsx scripts/test-ssh-wrapper-timing.ts
 */
import "dotenv/config"
import { Client } from "ssh2"
import { Daytona } from "@daytonaio/sdk"

const SSH_HOST = "ssh.app.daytona.io"
const SSH_PORT = 22

function execOverSsh(
  conn: Client,
  command: string,
  timeoutMs: number
): Promise<{ exitCode: number; output: string }> {
  return new Promise((resolve, reject) => {
    const timer = timeoutMs > 0 ? setTimeout(() => reject(new Error(`timeout ${timeoutMs}ms`)), timeoutMs) : undefined
    conn.exec(command, (err: Error | undefined, stream: import("ssh2").ClientChannel) => {
      if (err) {
        clearTimeout(timer as NodeJS.Timeout)
        reject(err)
        return
      }
      let stdout = ""
      let stderr = ""
      stream.on("data", (data: Buffer) => { stdout += data.toString() })
      stream.stderr.on("data", (data: Buffer) => { stderr += data.toString() })
      stream.on("close", (code: number) => {
        clearTimeout(timer as NodeJS.Timeout)
        resolve({ exitCode: code ?? 1, output: stdout + (stderr ? "\nSTDERR:\n" + stderr : "") })
      })
    })
  })
}

async function main() {
  if (!process.env.DAYTONA_API_KEY) {
    console.error("DAYTONA_API_KEY required")
    process.exit(1)
  }

  const daytona = new Daytona({ apiKey: process.env.DAYTONA_API_KEY })
  const sandbox = await daytona.create({ envVars: {} })

  // Trigger process API so sandbox is fully initialized (createSshAccess can need it)
  await (sandbox as { process: { executeCommand: (c: string) => Promise<unknown> } }).process.executeCommand("true")

  const getAccess = (sandbox as { createSshAccess?(m: number): Promise<{ token: string }> }).createSshAccess
  if (!getAccess) {
    console.error("Sandbox has no createSshAccess")
    process.exit(1)
  }

  const access = await getAccess(60)
  const conn = new Client()
  await new Promise<void>((resolve, reject) => {
    conn.on("ready", () => resolve())
    conn.on("error", reject)
    conn.connect({ host: SSH_HOST, port: SSH_PORT, username: access.token })
  })
  console.log("SSH connected\n")

  const cases: { name: string; command: string; timeoutMs: number }[] = [
    { name: "echo only", command: "echo 123", timeoutMs: 10_000 },
    { name: "true", command: "true", timeoutMs: 10_000 },
    { name: "sleep 1 then echo", command: "sleep 1 && echo 123", timeoutMs: 15_000 },
    { name: "sleep 3 then echo", command: "sleep 3 && echo 123", timeoutMs: 15_000 },
    { name: "background sleep 5, echo $! and cat pid (no wait)", command: "( sleep 5 & echo $! > /tmp/p.pid ; cat /tmp/p.pid )", timeoutMs: 15_000 },
    { name: "wrapper shape: ( ( sleep 10 ... ) & echo $! ; cat pid )", command: "( ( sleep 10 >> /tmp/out 2>&1 ; echo 1 > /tmp/out.done ) & echo $! > /tmp/w.pid ; cat /tmp/w.pid )", timeoutMs: 15_000 },
  ]

  for (const { name, command, timeoutMs } of cases) {
    const t0 = Date.now()
    const result = await execOverSsh(conn, command, timeoutMs)
    const ms = Date.now() - t0
    console.log(`[${(ms / 1000).toFixed(2)}s] ${name}`)
    console.log(`  exitCode=${result.exitCode} output=${JSON.stringify(result.output.trim().slice(0, 80))}`)
  }

  conn.end()
  await daytona.delete(sandbox.id)
  console.log("\nDone.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
