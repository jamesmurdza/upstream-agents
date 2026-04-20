import { Daytona } from "@daytonaio/sdk"
import { PATHS } from "@/lib/constants"
import { createBackgroundAgentSession } from "@/lib/agent-session"
import { getEnvForModel } from "@/lib/env-for-model"

export const maxDuration = 60

export async function POST(req: Request) {
  // 1. Parse request body
  const body = await req.json()
  const { sandboxId, sessionId, prompt, repoName, previewUrlPattern, agent, model, anthropicApiKey, anthropicAuthToken, openaiApiKey, opencodeApiKey, geminiApiKey } = body

  if (!sandboxId || !prompt || !repoName) {
    return Response.json({ error: "Missing required fields: sandboxId, prompt, repoName" }, { status: 400 })
  }

  // 2. Get Daytona API key
  const daytonaApiKey = process.env.DAYTONA_API_KEY
  if (!daytonaApiKey) {
    return Response.json(
      { error: "Daytona API key not configured" },
      { status: 500 }
    )
  }

  try {
    // 3. Get sandbox from Daytona
    const daytona = new Daytona({ apiKey: daytonaApiKey })
    let sandbox

    try {
      sandbox = await daytona.get(sandboxId)
    } catch {
      // Sandbox not found
      return Response.json(
        { error: "SANDBOX_NOT_FOUND", message: "Sandbox not found" },
        { status: 410 }
      )
    }

    // 4. Start sandbox if not running
    if (sandbox.state !== "started") {
      await sandbox.start(120) // 2 minute timeout
    }

    // 5. Build fresh env vars for the agent based on current credentials
    // This is a pure function - no accumulation, returns only what's needed now
    const env = getEnvForModel(model, agent || "opencode", {
      anthropicApiKey,
      anthropicAuthToken,
      openaiApiKey,
      opencodeApiKey,
      geminiApiKey,
    })

    // 6. Create background agent session
    const repoPath = `${PATHS.SANDBOX_HOME}/${repoName}`

    const bgSession = await createBackgroundAgentSession(sandbox, {
      repoPath,
      previewUrlPattern,
      sessionId: sessionId || undefined,  // Pass existing session ID for conversation continuity
      agent: agent || "opencode",
      model,
      env: Object.keys(env).length > 0 ? env : undefined,
    })

    // 7. Start the agent
    await bgSession.start(prompt)

    return Response.json({
      backgroundSessionId: bgSession.backgroundSessionId,
      status: "running",
    })
  } catch (error) {
    console.error("[agent/execute] Error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return Response.json({ error: message }, { status: 500 })
  }
}
