import { prisma } from "@/lib/db/prisma"
import { ensureSandboxStarted } from "@/lib/sandbox/sandbox-resume"
import {
  requireAuth,
  isAuthError,
  badRequest,
  notFound,
  getDaytonaApiKey,
  isDaytonaKeyError,
  internalError,
} from "@/lib/shared/api-helpers"
import { PATHS } from "@/lib/shared/constants"

// Timeout for file operations - 30 seconds
export const maxDuration = 30

/** Escape a string for use in shell commands */
function escapeShell(str: string): string {
  return str.replace(/'/g, "'\\''")
}

/** File extensions to look for in logs directory */
const LOG_EXTENSIONS = [".log", ".txt", ".json"]

/** Directories to ignore when searching for modified files */
const IGNORE_DIRS = ["node_modules", ".git", "dist", "build", ".next", "__pycache__", ".venv", "vendor"]

/**
 * Build find command to locate files modified after a marker file.
 * Uses -newer to compare against the marker file timestamp.
 */
function buildFindCommandNewerThan(
  repoPath: string,
  markerFile: string,
  ignoreDirs: string[]
): string {
  const safePath = escapeShell(repoPath)
  const safeMarker = escapeShell(markerFile)

  // Build ignore patterns for find -prune
  const ignoreArgs = ignoreDirs
    .map((dir) => `-name '${escapeShell(dir)}' -prune`)
    .join(" -o ")

  // Find files newer than marker, excluding ignored directories
  // The -newer flag compares mtime against the marker file
  const command = `find '${safePath}' \\( ${ignoreArgs} \\) -o -type f -newer '${safeMarker}' -print0 2>/dev/null | xargs -0 -r stat --format='%n|%Y|%s' 2>/dev/null | head -20 || true`

  return command
}

/**
 * Build find command for the logs directory (no clone timestamp baseline)
 * Returns all matching files in the logs directory
 */
function buildFindCommandForLogs(
  logsPath: string,
  extensions: string[]
): string {
  const safePath = escapeShell(logsPath)

  // Build extension match patterns
  const extPatterns = extensions
    .map((ext) => `-name '*${escapeShell(ext)}'`)
    .join(" -o ")

  // Find all files with matching extensions in the logs directory
  const command = `find '${safePath}' -type f \\( ${extPatterns} \\) -print0 2>/dev/null | xargs -0 -r stat --format='%n|%Y|%s' 2>/dev/null | head -20 || true`

  return command
}

/**
 * Build find command for /tmp/claude directory (Claude Code task output files)
 * Looks for .output files in task directories like /tmp/claude/-home-daytona/tasks/*.output
 */
function buildFindCommandForClaudeLogs(claudePath: string): string {
  const safePath = escapeShell(claudePath)

  // Find all .output files in the claude directory (task output files)
  const command = `find '${safePath}' -type f -name '*.output' -print0 2>/dev/null | xargs -0 -r stat --format='%n|%Y|%s' 2>/dev/null | head -20 || true`

  return command
}

/**
 * Parse the output of find + stat command
 */
function parseStatOutput(output: string): Array<{ path: string; modifiedAt: number; size: number }> {
  const files: Array<{ path: string; modifiedAt: number; size: number }> = []
  const lines = output.trim().split("\n").filter(Boolean)

  for (const line of lines) {
    const parts = line.split("|")
    if (parts.length >= 3) {
      const path = parts[0]
      const mtime = parseInt(parts[1], 10)
      const size = parseInt(parts[2], 10)

      if (path && !isNaN(mtime) && !isNaN(size)) {
        files.push({
          path,
          modifiedAt: mtime * 1000, // Convert to milliseconds
          size,
        })
      }
    }
  }

  // Sort by modification time (most recent first) and limit to 20
  return files
    .sort((a, b) => b.modifiedAt - a.modifiedAt)
    .slice(0, 10)
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  let body: {
    sandboxId?: string
    repoPath?: string
    action?: string
    filePath?: string
    command?: string
    maxLines?: number
  }
  try {
    body = await req.json()
  } catch {
    return badRequest("Invalid or empty JSON body")
  }

  const { sandboxId, repoPath, action, filePath } = body

  if (!sandboxId || !repoPath || !action) {
    return badRequest("Missing required fields")
  }

  // Verify ownership
  const sandboxRecord = await prisma.sandbox.findUnique({
    where: { sandboxId },
  })

  if (!sandboxRecord || sandboxRecord.userId !== auth.userId) {
    return notFound("Sandbox not found")
  }

  const daytonaApiKey = getDaytonaApiKey()
  if (isDaytonaKeyError(daytonaApiKey)) return daytonaApiKey

  try {
    const sandbox = await ensureSandboxStarted(daytonaApiKey, sandboxId)

    switch (action) {
      case "list-modified": {
        // Find files modified after the clone marker file
        // This marker is created right after git clone completes
        const repoCommand = buildFindCommandNewerThan(repoPath, PATHS.CLONE_MARKER_FILE, IGNORE_DIRS)
        const repoResult = await sandbox.process.executeCommand(repoCommand, undefined, undefined, 30)
        const repoFiles = parseStatOutput(repoResult.result || "")

        // Also check the logs directory for any log files
        const logsCommand = buildFindCommandForLogs(PATHS.LOGS_DIR, LOG_EXTENSIONS)
        const logsResult = await sandbox.process.executeCommand(logsCommand, undefined, undefined, 30)
        const logsFiles = parseStatOutput(logsResult.result || "")

        // Also check /tmp/claude for Claude Code task output files
        const claudeLogsCommand = buildFindCommandForClaudeLogs("/tmp/claude")
        const claudeLogsResult = await sandbox.process.executeCommand(claudeLogsCommand, undefined, undefined, 30)
        const claudeLogsFiles = parseStatOutput(claudeLogsResult.result || "")

        // Merge and sort all files by modification time (most recent first)
        const allFiles = [...repoFiles, ...logsFiles, ...claudeLogsFiles]
          .sort((a, b) => b.modifiedAt - a.modifiedAt)
          .slice(0, 10)

        return Response.json({ files: allFiles })
      }

      case "read-file": {
        if (!filePath) {
          return badRequest("Missing filePath")
        }

        const safePath = escapeShell(filePath)
        const maxLines = body.maxLines

        // Get file metadata first
        const statResult = await sandbox.process.executeCommand(
          `stat --format='%Y|%s' '${safePath}' 2>/dev/null || echo 'error'`
        )

        if (statResult.result?.trim() === "error" || statResult.exitCode !== 0) {
          return notFound("File not found")
        }

        const parts = statResult.result.trim().split("|")
        const mtime = parseInt(parts[0], 10)
        const size = parseInt(parts[1], 10)

        // Limit file size to 500KB (skip for preview requests)
        if (!maxLines && size > 500 * 1024) {
          return Response.json({
            error: "File too large",
            path: filePath,
            size,
            modifiedAt: mtime * 1000,
          }, { status: 413 })
        }

        // Read file content (partial with head, or full with cat)
        const readCmd = maxLines
          ? `head -n ${maxLines} '${safePath}' 2>/dev/null`
          : `cat '${safePath}' 2>/dev/null`
        const readResult = await sandbox.process.executeCommand(readCmd)

        const content = readResult.result || ""
        // Only mark as truncated if we actually cut lines off
        const actuallyTruncated = !!maxLines && content.split("\n").length >= maxLines

        return Response.json({
          path: filePath,
          content,
          modifiedAt: mtime * 1000,
          size,
          truncated: actuallyTruncated,
        })
      }

      case "list-servers": {
        // List running dev servers by checking listening TCP ports
        // Use ss (socket statistics) to find listening ports
        // Filter for common dev server ports (3000-9999) and exclude system services
        const ssResult = await sandbox.process.executeCommand(
          `ss -tlnp 2>/dev/null | grep -E 'LISTEN.*:(3[0-9]{3}|4[0-9]{3}|5[0-9]{3}|6[0-9]{3}|7[0-9]{3}|8[0-9]{3}|9[0-9]{3})' | awk '{print $4}' | sed 's/.*://' | sort -n | uniq || true`,
          undefined,
          undefined,
          10
        )

        const ports: number[] = []
        const lines = (ssResult.result || "").trim().split("\n").filter(Boolean)

        for (const line of lines) {
          const port = parseInt(line.trim(), 10)
          // Only include ports in the dev server range (3000-9999)
          if (!isNaN(port) && port >= 3000 && port <= 9999) {
            ports.push(port)
          }
        }

        // Get the preview URL pattern from the sandbox record
        const previewUrlPattern = sandboxRecord.previewUrlPattern || null

        return Response.json({
          ports,
          previewUrlPattern,
        })
      }

      case "execute-command": {
        const { command } = body
        if (!command) {
          return badRequest("Missing command")
        }

        // Execute the command in the repo directory
        const safePath = escapeShell(repoPath)
        const result = await sandbox.process.executeCommand(
          `cd '${safePath}' && ${command}`,
          undefined,
          undefined,
          30 // 30 second timeout
        )

        return Response.json({
          output: result.result || "",
          exitCode: result.exitCode,
        })
      }

      default:
        return badRequest(`Unknown action: ${action}`)
    }
  } catch (error: unknown) {
    return internalError(error)
  }
}
