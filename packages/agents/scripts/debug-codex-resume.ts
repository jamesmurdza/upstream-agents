#!/usr/bin/env npx tsx
/**
 * Debug Codex CLI resume behavior inside the sandbox.
 * Runs one prompt to get a thread_id, then resumes with a follow-up prompt,
 * capturing RAW stdout/stderr (not JSON-filtered).
 */
import { Daytona } from "@daytonaio/sdk"

const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY!
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!

function extractThreadId(raw: string): string | null {
  const line = raw.split("\n").find((l) => l.includes("\"type\":\"thread.started\"") && l.includes("\"thread_id\""))
  if (!line) return null
  try {
    const j = JSON.parse(line) as { thread_id?: string }
    return j.thread_id ?? null
  } catch {
    return null
  }
}

async function main() {
  const daytona = new Daytona({ apiKey: DAYTONA_API_KEY })
  const sandbox = await daytona.create({
    envVars: { OPENAI_API_KEY },
  })

  try {
    await sandbox.process.executeCommand("npm install -g @openai/codex", undefined, undefined, 120)
    await sandbox.process.executeCommand(`echo "${OPENAI_API_KEY}" | codex login --with-api-key 2>&1`, undefined, undefined, 30)

    const first = await sandbox.process.executeCommand(`codex exec --json --skip-git-repo-check --yolo "hi" 2>&1`, undefined, undefined, 60)
    const firstOutput = first.result ?? ""
    console.log("=== first (raw) ===")
    console.log(firstOutput)
    const threadId = extractThreadId(firstOutput)
    console.log("thread_id:", threadId)

    if (!threadId) process.exit(1)

    const second = await sandbox.process.executeCommand(
      `codex exec --json --skip-git-repo-check --yolo resume ${threadId} "hey" 2>&1`,
      undefined,
      undefined,
      60
    )
    console.log("\n=== exec resume <id> (raw) ===")
    console.log(second.result ?? "")
  } finally {
    await sandbox.delete()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

