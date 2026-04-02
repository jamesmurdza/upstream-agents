# Agent instructions

Primary reference for coding agents working in this repo.

---

## Quick start (local machine)

Typical laptop development (not the Daytona sandbox VM below):

- **Install:** `npm install && npm run build:sdk`
- **DB:** `cd packages/web && npx prisma db push` — configure `packages/web/.env` first (see root **README** for full local env).
- **Dev server:** `npm run dev` — app at http://localhost:3000 (usually needs `GITHUB_PAT` + `DAYTONA_API_KEY` in `packages/web/.env`).
- **SDK tests:** `npm run test -w @upstream/agents`
- **Web E2E (Playwright):** `cd packages/web && npm run test:e2e` — env and commands are in *Web E2E (Playwright)* under Testing below.

---

## Starting the development server (Daytona sandbox)

In the hosted sandbox workspace, `GITHUB_PAT` and `DAYTONA_API_KEY` are often already set.

### 1. Install PostgreSQL and Create Database

```bash
sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER sandboxed WITH PASSWORD 'sandboxed123';"
sudo -u postgres psql -c "CREATE DATABASE sandboxed_agents OWNER sandboxed;"
```

### 2. Create Environment File

Create `packages/web/.env` with the Daytona proxy URL (replace `{sandbox-id}` with actual ID):

```bash
cat > packages/web/.env << 'EOF'
DATABASE_URL="postgresql://sandboxed:sandboxed123@localhost:5432/sandboxed_agents"
DATABASE_URL_UNPOOLED="postgresql://sandboxed:sandboxed123@localhost:5432/sandboxed_agents"
NEXTAUTH_URL="https://3000-{sandbox-id}.daytonaproxy01.net"
NEXTAUTH_SECRET="dev-secret"
GITHUB_CLIENT_ID="placeholder"
GITHUB_CLIENT_SECRET="placeholder"
ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000"
EOF
```

**CRITICAL:** `NEXTAUTH_URL` must be the Daytona proxy URL, not `localhost:3000`.

### 3. Install, Build, and Initialize

```bash
npm install
npm run build:sdk
cd packages/web && npx prisma db push && cd ../..
```

### 4. Start the Server

```bash
nohup npm run dev > server.log 2>&1 &
```

The app is accessible at: `https://3000-{sandbox-id}.daytonaproxy01.net`

---

## Testing

### SDK unit tests (no API keys)

```bash
npm run test -w @upstream/agents
```

### SDK integration tests

Integration tests require real Daytona sandboxes. Tests are skipped automatically when required environment variables are missing.

```bash
# Integration tests (OpenCode subset needs only Daytona)
DAYTONA_API_KEY=dtn_... npm run test -w @upstream/agents -- tests/integration/

# Claude provider tests (requires Anthropic key)
DAYTONA_API_KEY=dtn_... ANTHROPIC_API_KEY=sk-ant-... npm run test -w @upstream/agents -- tests/integration/

# Run all SDK tests including integration
DAYTONA_API_KEY=dtn_... ANTHROPIC_API_KEY=sk-ant-... npm run test -w @upstream/agents
```

### Web E2E (Playwright)

These tests start a real Next.js dev server, a dedicated PostgreSQL database, real Daytona sandboxes, and drive the same UI as production (chat, polling, sync). Setup uses `POST /api/e2e/setup` (that route returns 404 when `NODE_ENV=production`).

**Prerequisites**

- `DAYTONA_API_KEY` in the environment (Playwright loads repo root `.env` via `playwright.config.ts`).
- `packages/web/.env.e2e` with at least `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEXTAUTH_SECRET`, and `ENCRYPTION_KEY`. Use a database separate from your normal dev DB.
- Optional: `E2E_CLAUDE_OAUTH_JSON` in `.env.e2e` — same JSON as Settings → Claude subscription (including `claudeAiOauth`). When set, `POST /api/e2e/setup` seeds the e2e user with Claude Max OAuth and uses agent `claude-code` instead of OpenCode so agent runs do not depend on OpenCode reachability.

**Run** (from `packages/web`):

```bash
npm run test:e2e
```

**Run a subset:**

```bash
npx playwright test e2e/app/single-agent.spec.ts
npx playwright test e2e/app
```

**Stream / polling diagnostics** (reproducing flaky chat streams): run `e2e/diagnostics/stream-bug-repro.spec.ts`. Failures attach `stream-instrumentation.txt` (`/api/agent/*` response codes from the test browser).

```bash
cd packages/web && npm run test:e2e -- e2e/diagnostics/stream-bug-repro.spec.ts
```

**Layout**

| Path | Purpose |
|------|---------|
| `e2e/fixtures/` | Shared fixture (`agent-fixture.ts`) and named timeouts (`timeouts.ts`) |
| `e2e/app/` | Full-app flows: `single-agent.spec.ts`, `multi-agent.spec.ts` |
| `e2e/diagnostics/` | Stream bug repro + instrumentation helpers |

Config: `packages/web/playwright.config.ts` — dev server on port 3001, `NEXT_DIST_DIR=.next-e2e`, `workers: 1`.

### Manual SDK testing

```bash
# Interactive REPL with Claude (streaming)
DAYTONA_API_KEY=dtn_... ANTHROPIC_API_KEY=sk-ant-... npx tsx packages/agents/scripts/repl.ts

# REPL with other providers
npx tsx packages/agents/scripts/repl.ts --provider codex   # requires OPENAI_API_KEY
npx tsx packages/agents/scripts/repl.ts --provider opencode
npx tsx packages/agents/scripts/repl.ts --provider gemini  # requires GEMINI_API_KEY

# Polling-based background session REPL
DAYTONA_API_KEY=dtn_... ANTHROPIC_API_KEY=sk-ant-... npx tsx packages/agents/scripts/repl-polling.ts

# Full integration test script
DAYTONA_API_KEY=dtn_... ANTHROPIC_API_KEY=sk-ant-... npx tsx packages/agents/scripts/test-sdk-full.ts
```

### Debug mode

Set `CODING_AGENTS_DEBUG=1` to enable verbose logging:

```bash
CODING_AGENTS_DEBUG=1 npx tsx packages/agents/scripts/repl-polling.ts
```

This logs agent lifecycle events, background session details, and unparsed output.
