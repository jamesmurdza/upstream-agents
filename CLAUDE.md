# Claude — project notes

## Testing

### SDK (`packages/agents`)

**Unit tests** (no API keys):

```bash
npm run test -w @upstream/agents
```

**Integration tests** (real Daytona sandboxes; skipped if env vars are missing):

```bash
# OpenCode — only DAYTONA_API_KEY
DAYTONA_API_KEY=dtn_... npm run test -w @upstream/agents -- tests/integration/

# With Claude provider tests
DAYTONA_API_KEY=dtn_... ANTHROPIC_API_KEY=sk-ant-... npm run test -w @upstream/agents -- tests/integration/
```

See `packages/agents/README.md` and `packages/agents/TESTING_GUIDE.md` for details.

### Web app — Playwright E2E (`packages/web`)

These tests start a **real** Next.js dev server, **real** PostgreSQL (from env), **real** Daytona sandboxes, and drive the **production UI** (not a harness). They use dev-auth via `POST /api/e2e/setup` (disabled when `NODE_ENV=production`).

**Requirements**

- `DAYTONA_API_KEY` in the environment (loaded from repo root `.env` by Playwright config).
- `packages/web/.env.e2e` with `DATABASE_URL`, `NEXTAUTH_SECRET`, `ENCRYPTION_KEY` (and any other vars the config expects). Use a **dedicated local DB** for E2E, not your main dev database.

**Run** (from `packages/web`):

```bash
npm run test:e2e
```

**Run one file or folder**:

```bash
npx playwright test e2e/app/single-agent.spec.ts
npx playwright test e2e/app
npx playwright test e2e/regression
```

**Layout**

| Path | Purpose |
|------|---------|
| `e2e/fixtures/` | Shared Playwright fixture (`agent-fixture.ts`), named timeouts (`timeouts.ts`) |
| `e2e/app/` | Full-app flows: `single-agent.spec.ts`, `multi-agent.spec.ts` |
| `e2e/regression/` | Targeted regressions (e.g. sync/poller races): `active-branch-stuck.spec.ts` |

Playwright config: `packages/web/playwright.config.ts` (isolated `NEXT_DIST_DIR`, port `3001`, `workers: 1`).

### Manual SDK / REPL

See `AGENTS.md` for REPL commands, `CODING_AGENTS_DEBUG`, and Daytona sandbox dev-server setup.
