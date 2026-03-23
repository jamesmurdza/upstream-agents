/**
 * Codex rules configuration
 * Sets up Starlark rules that block dangerous git operations
 */

import fs from "fs"
import path from "path"
import type { Sandbox } from "@daytonaio/sdk"

// Load rules file from the hooks directory at module load time
const HOOKS_DIR = path.join(process.cwd(), "hooks")
const CODEX_RULES = fs.readFileSync(
  path.join(HOOKS_DIR, "codex-rules.star"),
  "utf-8"
)

// Codex rules directory path
const CODEX_RULES_DIR = "/home/daytona/.codex/rules"
const CODEX_RULES_FILE = `${CODEX_RULES_DIR}/default.rules`

/**
 * Sets up Codex rules in a sandbox.
 * This uploads the Starlark rules file that blocks dangerous git operations.
 */
export async function setupCodexRules(sandbox: Sandbox): Promise<void> {
  // Create the rules directory
  await sandbox.process.executeCommand(`mkdir -p ${CODEX_RULES_DIR}`)

  // Upload the rules file
  await sandbox.fs.uploadFile(
    Buffer.from(CODEX_RULES, "utf-8"),
    CODEX_RULES_FILE
  )

  // Set proper permissions
  await sandbox.process.executeCommand(`chmod 600 ${CODEX_RULES_FILE}`)
}
