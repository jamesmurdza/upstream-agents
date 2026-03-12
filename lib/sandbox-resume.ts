import { Daytona } from "@daytonaio/sdk"

/**
 * Ensures a sandbox is running.
 * If stopped, it restarts it.
 *
 * Note: The coding-agents-sdk handles agent installation internally,
 * so we no longer need to upload Python scripts or create contexts here.
 */
export async function ensureSandboxReady(
  daytonaApiKey: string,
  sandboxId: string,
): Promise<{
  sandbox: Awaited<ReturnType<InstanceType<typeof Daytona>["get"]>>
  wasResumed: boolean
  resumeSessionId?: string
}> {
  const daytona = new Daytona({ apiKey: daytonaApiKey })
  const sandbox = await daytona.get(sandboxId)

  // If sandbox is already started, check for stored session ID
  if (sandbox.state === "started") {
    let resumeSessionId: string | undefined
    try {
      const result = await sandbox.process.executeCommand(
        "cat /home/daytona/.agent_session_id 2>/dev/null"
      )
      if (!result.exitCode && result.result.trim()) {
        resumeSessionId = result.result.trim()
      }
    } catch {
      // ignore
    }
    return { sandbox, wasResumed: false, resumeSessionId }
  }

  // Sandbox is stopped — start it
  await sandbox.start(120)

  // Read stored session ID for agent resumption
  let resumeSessionId: string | undefined
  try {
    const result = await sandbox.process.executeCommand(
      "cat /home/daytona/.agent_session_id 2>/dev/null"
    )
    if (!result.exitCode && result.result.trim()) {
      resumeSessionId = result.result.trim()
    }
  } catch {
    // No stored session — that's fine
  }

  return { sandbox, wasResumed: true, resumeSessionId }
}

/**
 * Lighter version — just ensures a sandbox is running.
 * Used for git/SSH operations that don't need the agent context.
 */
export async function ensureSandboxStarted(
  daytonaApiKey: string,
  sandboxId: string,
): Promise<Awaited<ReturnType<InstanceType<typeof Daytona>["get"]>>> {
  const daytona = new Daytona({ apiKey: daytonaApiKey })
  const sandbox = await daytona.get(sandboxId)

  if (sandbox.state !== "started") {
    await sandbox.start(120)
  }

  return sandbox
}
