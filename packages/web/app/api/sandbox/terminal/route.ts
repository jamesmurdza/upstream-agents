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

// Timeout for terminal setup - 60 seconds
export const maxDuration = 60

// Port for the WebSocket PTY server (unique high port to avoid conflicts with dev servers)
const PTY_SERVER_PORT = 44777

/**
 * POST /api/sandbox/terminal
 *
 * Sets up a WebSocket PTY terminal server in the sandbox.
 * Returns the WebSocket URL for connecting from the browser.
 *
 * Request body:
 *   - sandboxId: string - The sandbox ID
 *   - action: "setup" | "status" | "stop"
 *
 * Response:
 *   - websocketUrl: string - The WebSocket URL to connect to
 *   - httpsUrl: string - The HTTPS URL for health checks
 *   - status: "running" | "starting" | "stopped" | "error"
 */
export async function POST(req: Request) {
  const auth = await requireAuth()
  if (isAuthError(auth)) return auth

  let body: {
    sandboxId?: string
    action?: "setup" | "status" | "stop"
  }

  try {
    body = await req.json()
  } catch {
    return badRequest("Invalid or empty JSON body")
  }

  const { sandboxId, action = "setup" } = body

  if (!sandboxId) {
    return badRequest("Missing sandboxId")
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
      case "status": {
        // Check if PTY server is running
        const checkProcess = await sandbox.process.executeCommand(
          `pgrep -f "node.*websocket-pty-server" > /dev/null && echo "running" || echo "stopped"`,
          undefined,
          undefined,
          10
        )
        const status = checkProcess.result?.trim() === "running" ? "running" : "stopped"

        if (status === "running") {
          // Get signed preview URL
          const signedUrl = await sandbox.getSignedPreviewUrl(PTY_SERVER_PORT, 3600)
          const wsUrl = signedUrl.url.replace("https://", "wss://")

          return Response.json({
            status,
            websocketUrl: wsUrl,
            httpsUrl: signedUrl.url,
            port: PTY_SERVER_PORT,
          })
        }

        return Response.json({ status })
      }

      case "stop": {
        // Kill the PTY server process
        await sandbox.process.executeCommand(
          `pkill -f "node.*websocket-pty-server" || true`,
          undefined,
          undefined,
          10
        )
        return Response.json({ status: "stopped" })
      }

      case "setup":
      default: {
        // Check if already running
        const checkProcess = await sandbox.process.executeCommand(
          `pgrep -f "node.*websocket-pty-server" > /dev/null && echo "running" || echo "stopped"`,
          undefined,
          undefined,
          10
        )

        if (checkProcess.result?.trim() === "running") {
          // Already running, just return the URL
          const signedUrl = await sandbox.getSignedPreviewUrl(PTY_SERVER_PORT, 3600)
          const wsUrl = signedUrl.url.replace("https://", "wss://")

          return Response.json({
            status: "running",
            websocketUrl: wsUrl,
            httpsUrl: signedUrl.url,
            port: PTY_SERVER_PORT,
          })
        }

        // Get the PTY server code (inlined to avoid bundling node-pty in Next.js)
        // The server code runs inside the sandbox, not in the Next.js app
        const serverCode = getInlineServerCode()
        const packageJson = JSON.stringify({
          name: "websocket-pty-server",
          version: "1.0.0",
          dependencies: { ws: "^8.18.0", "node-pty": "^1.0.0" },
        })

        // Upload server files to sandbox
        await sandbox.fs.uploadFile(
          Buffer.from(serverCode),
          "/tmp/websocket-pty-server.js"
        )
        await sandbox.fs.uploadFile(
          Buffer.from(packageJson),
          "/tmp/pty-package.json"
        )

        // Install dependencies
        const installResult = await sandbox.process.executeCommand(
          `cd /tmp && npm install --prefix /tmp ws node-pty 2>&1`,
          undefined,
          undefined,
          60
        )

        if (installResult.exitCode !== 0) {
          console.error("[terminal] Failed to install dependencies:", installResult.result)
          return Response.json(
            {
              status: "error",
              error: "Failed to install terminal dependencies",
              details: installResult.result,
            },
            { status: 500 }
          )
        }

        // Start the PTY server
        const startResult = await sandbox.process.executeCommand(
          `cd /tmp && nohup node websocket-pty-server.js > /tmp/pty-server.log 2>&1 &`,
          undefined,
          undefined,
          10
        )

        if (startResult.exitCode !== 0) {
          console.error("[terminal] Failed to start server:", startResult.result)
          return Response.json(
            {
              status: "error",
              error: "Failed to start terminal server",
              details: startResult.result,
            },
            { status: 500 }
          )
        }

        // Wait for server to start
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Verify server is running
        const verifyProcess = await sandbox.process.executeCommand(
          `pgrep -f "node.*websocket-pty-server" > /dev/null && echo "running" || echo "stopped"`,
          undefined,
          undefined,
          10
        )

        if (verifyProcess.result?.trim() !== "running") {
          // Check the log for errors
          const logResult = await sandbox.process.executeCommand(
            `cat /tmp/pty-server.log 2>/dev/null | tail -20`,
            undefined,
            undefined,
            10
          )
          console.error("[terminal] Server failed to start, log:", logResult.result)

          return Response.json(
            {
              status: "error",
              error: "Terminal server failed to start",
              details: logResult.result,
            },
            { status: 500 }
          )
        }

        // Get signed preview URL
        const signedUrl = await sandbox.getSignedPreviewUrl(PTY_SERVER_PORT, 3600)
        const wsUrl = signedUrl.url.replace("https://", "wss://")

        return Response.json({
          status: "running",
          websocketUrl: wsUrl,
          httpsUrl: signedUrl.url,
          port: PTY_SERVER_PORT,
        })
      }
    }
  } catch (error: unknown) {
    console.error("[terminal] Error:", error)
    return internalError(error)
  }
}

/**
 * Inline server code as fallback
 */
function getInlineServerCode(): string {
  return `
const http = require('http');
const WebSocket = require('ws');
const pty = require('node-pty');
const os = require('os');

const PORT = process.env.PTY_PORT || 44777;

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end('WebSocket PTY Server Running');
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const wss = new WebSocket.Server({ server, path: '/', verifyClient: (info, cb) => cb(true) });

wss.on('connection', (ws, req) => {
  console.log('[WS] Connection from:', req.socket.remoteAddress);

  const shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 30,
    cwd: process.env.HOME || os.homedir(),
    env: { ...process.env, TERM: 'xterm-256color' }
  });

  ptyProcess.onData((data) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'data', payload: data }));
      }
    } catch (e) {}
  });

  ws.send(JSON.stringify({ type: 'ready', pid: ptyProcess.pid }));

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'input') ptyProcess.write(parsed.payload);
      else if (parsed.type === 'resize') ptyProcess.resize(parsed.cols, parsed.rows);
    } catch (e) {}
  });

  ws.on('close', () => { ptyProcess.kill(); });
  ws.on('error', () => { ptyProcess.kill(); });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('[Server] Listening on port ' + PORT);
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
`.trim()
}
