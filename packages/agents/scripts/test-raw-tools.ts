#!/usr/bin/env npx tsx
/**
 * Test script to capture RAW tool call output from each provider's CLI
 */
import { Daytona } from "@daytonaio/sdk"

const DAYTONA_API_KEY = process.env.DAYTONA_API_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

const PROMPT = "Write a file called /tmp/hello.txt with the content 'Hello World'. Just write the file, nothing else."

function out(r: { result?: string }): string {
  return r.result ?? ""
}

async function testClaude() {
  console.log("\n" + "=".repeat(70))
  console.log("  CLAUDE RAW OUTPUT")
  console.log("=".repeat(70))

  const daytona = new Daytona({ apiKey: DAYTONA_API_KEY })
  const sandbox = await daytona.create({
    envVars: { ANTHROPIC_API_KEY: ANTHROPIC_API_KEY! },
  })

  try {
    console.log("Installing Claude CLI...")
    await sandbox.process.executeCommand("npm install -g @anthropic-ai/claude-code", undefined, undefined, 120)
    console.log("Running Claude...")
    const result = await sandbox.process.executeCommand(
      `claude -p --output-format stream-json --verbose --dangerously-skip-permissions "${PROMPT}"`,
      undefined,
      undefined,
      120
    )
    console.log("\n--- RAW OUTPUT ---")
    console.log(out(result))
  } finally {
    await sandbox.delete()
  }
}

async function testCodex() {
  console.log("\n" + "=".repeat(70))
  console.log("  CODEX RAW OUTPUT")
  console.log("=".repeat(70))

  const daytona = new Daytona({ apiKey: DAYTONA_API_KEY })
  const sandbox = await daytona.create({
    envVars: { OPENAI_API_KEY: OPENAI_API_KEY! },
  })

  try {
    console.log("Installing Codex CLI...")
    await sandbox.process.executeCommand("npm install -g @openai/codex", undefined, undefined, 120)
    await sandbox.process.executeCommand(`echo "${OPENAI_API_KEY}" | codex login --with-api-key 2>&1`, undefined, undefined, 30)
    console.log("Running Codex...")
    const result = await sandbox.process.executeCommand(
      `codex exec --json --skip-git-repo-check --full-auto "${PROMPT}"`,
      undefined,
      undefined,
      120
    )
    console.log("\n--- RAW OUTPUT ---")
    console.log(out(result))
  } finally {
    await sandbox.delete()
  }
}

async function testGemini() {
  console.log("\n" + "=".repeat(70))
  console.log("  GEMINI RAW OUTPUT")
  console.log("=".repeat(70))

  const daytona = new Daytona({ apiKey: DAYTONA_API_KEY })
  const sandbox = await daytona.create({
    envVars: { GEMINI_API_KEY: GEMINI_API_KEY! },
  })

  try {
    console.log("Installing Gemini CLI...")
    await sandbox.process.executeCommand("npm install -g @google/gemini-cli", undefined, undefined, 120)
    await sandbox.process.executeCommand("mkdir -p /home/daytona/.gemini", undefined, undefined, 10)
    console.log("Running Gemini...")
    const result = await sandbox.process.executeCommand(
      `gemini -p "${PROMPT}" --output-format stream-json --yolo 2>&1`,
      undefined,
      undefined,
      120
    )
    console.log("\n--- RAW OUTPUT ---")
    console.log(out(result))
  } finally {
    await sandbox.delete()
  }
}

async function testOpenCode() {
  console.log("\n" + "=".repeat(70))
  console.log("  OPENCODE RAW OUTPUT")
  console.log("=".repeat(70))

  const daytona = new Daytona({ apiKey: DAYTONA_API_KEY })
  const sandbox = await daytona.create({
    envVars: { OPENAI_API_KEY: OPENAI_API_KEY! },
  })

  try {
    console.log("Installing OpenCode...")
    await sandbox.process.executeCommand("npm install -g opencode@latest", undefined, undefined, 120)
    const whichResult = await sandbox.process.executeCommand("which opencode || echo 'not found'", undefined, undefined, 10)
    console.log("OpenCode location:", out(whichResult).trim())
    console.log("Running OpenCode...")
    const result = await sandbox.process.executeCommand(
      `OPENCODE_YOLO=true opencode run --format json --variant medium -m openai/gpt-4o --log-level ERROR "${PROMPT}" 2>&1`,
      undefined,
      undefined,
      120
    )
    console.log("\n--- RAW OUTPUT ---")
    console.log(out(result))
  } finally {
    await sandbox.delete()
  }
}

async function main() {
  console.log("============================================================")
  console.log("  Capturing RAW Tool Call Output from CLI")
  console.log("============================================================")

  if (ANTHROPIC_API_KEY) {
    await testClaude()
  }

  if (OPENAI_API_KEY) {
    await testCodex()
  }

  if (GEMINI_API_KEY) {
    await testGemini()
  }

  if (OPENAI_API_KEY) {
    await testOpenCode()
  }

  console.log("\n" + "=".repeat(70))
  console.log("  Done!")
  console.log("=".repeat(70))
}

main().catch(console.error)
