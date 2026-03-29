/**
 * Claude Code hooks configuration
 * Sets up hooks that run during Claude Code execution to enforce rules
 */

import fs from "fs"
import path from "path"
import type { Sandbox } from "@daytonaio/sdk"
import { PATHS } from "@/lib/shared/constants"

// Load hook files from the hooks directory at module load time
const HOOKS_DIR = path.join(process.cwd(), "hooks")
const PREVENT_DANGEROUS_GIT_SCRIPT = fs.readFileSync(
  path.join(HOOKS_DIR, "prevent-dangerous-git.sh"),
  "utf-8"
)
const CLAUDE_SETTINGS = JSON.parse(
  fs.readFileSync(path.join(HOOKS_DIR, "settings.json"), "utf-8")
)

/**
 * Sets up Claude Code hooks in a sandbox using the Daytona SDK's file upload API.
 * This uploads the hook scripts and settings file directly to the sandbox.
 */
export async function setupClaudeHooks(sandbox: Sandbox): Promise<void> {
  // Create the hooks directory
  await sandbox.process.executeCommand(`mkdir -p ${PATHS.CLAUDE_HOOKS_DIR}`)

  // Upload the hook script
  await sandbox.fs.uploadFile(
    Buffer.from(PREVENT_DANGEROUS_GIT_SCRIPT, "utf-8"),
    `${PATHS.CLAUDE_HOOKS_DIR}/prevent-dangerous-git.sh`
  )

  // Make it executable
  await sandbox.process.executeCommand(
    `chmod +x ${PATHS.CLAUDE_HOOKS_DIR}/prevent-dangerous-git.sh`
  )

  // Upload the settings file (merge with existing if present)
  const existingResult = await sandbox.process.executeCommand(
    `cat ${PATHS.CLAUDE_SETTINGS_FILE} 2>/dev/null || echo '{}'`
  ) as { result: string }

  const existing = JSON.parse(existingResult.result.trim() || "{}")

  // Deep merge hooks
  if (!existing.hooks) existing.hooks = {}
  for (const [event, handlers] of Object.entries(CLAUDE_SETTINGS.hooks || {})) {
    if (!existing.hooks[event]) existing.hooks[event] = []
    for (const handler of handlers as Array<Record<string, unknown>>) {
      const exists = existing.hooks[event].some(
        (h: Record<string, unknown>) => JSON.stringify(h) === JSON.stringify(handler)
      )
      if (!exists) existing.hooks[event].push(handler)
    }
  }

  await sandbox.fs.uploadFile(
    Buffer.from(JSON.stringify(existing, null, 2), "utf-8"),
    PATHS.CLAUDE_SETTINGS_FILE
  )

  // Set proper permissions
  await sandbox.process.executeCommand(`chmod 600 ${PATHS.CLAUDE_SETTINGS_FILE}`)
}
