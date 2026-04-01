import { defineConfig } from "@playwright/test"
import { config as loadEnv } from "dotenv"
import path from "node:path"

// Load DAYTONA_API_KEY from the root .env (the only thing we need from there)
loadEnv({ path: path.resolve(__dirname, "../../.env") })
// Load test-specific config (DB, auth) — overrides root .env
loadEnv({ path: path.resolve(__dirname, ".env.e2e"), override: true })

const testDbUrl = process.env.DATABASE_URL!
const port = 3001

/** When set to 1, Next dev enables [stream-debug] console logs in useExecutionPoller (see e2e/diagnostics). */
const e2eStreamDebug =
  process.env.PLAYWRIGHT_STREAM_DEBUG === "1" ? "NEXT_PUBLIC_E2E_STREAM_DEBUG=1" : ""

export default defineConfig({
  testDir: "./e2e",
  timeout: 5 * 60_000,
  expect: { timeout: 3 * 60_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: [
      `NEXT_DIST_DIR=.next-e2e`,
      ...(e2eStreamDebug ? [e2eStreamDebug] : []),
      `DATABASE_URL="${testDbUrl}"`,
      `DATABASE_URL_UNPOOLED="${testDbUrl}"`,
      `NEXTAUTH_URL="http://localhost:${port}"`,
      `NEXTAUTH_SECRET="${process.env.NEXTAUTH_SECRET}"`,
      `ENCRYPTION_KEY="${process.env.ENCRYPTION_KEY}"`,
      `DAYTONA_API_KEY="${process.env.DAYTONA_API_KEY}"`,
      `GITHUB_CLIENT_ID=placeholder`,
      `GITHUB_CLIENT_SECRET=placeholder`,
      `npx next dev --port ${port}`,
    ].join(" "),
    port,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
