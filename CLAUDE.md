# Claude / coding agents

**Read [AGENTS.md](./AGENTS.md) first.** It has the commands for local quick start, the Daytona sandbox dev server, SDK tests, **Playwright E2E**, REPLs, and debug logging.

**Where to look next**

| Doc / area | What it’s for |
|------------|----------------|
| [README.md](./README.md) | Architecture, deployment, env vars, database schema overview |
| [packages/agents/README.md](./packages/agents/README.md) | SDK (`@upstream/agents`): API, providers, building |
| [packages/agents/TESTING_GUIDE.md](./packages/agents/TESTING_GUIDE.md) | SDK test layout and integration tests |
| `packages/web/app/` | Next.js App Router routes and API routes |
| `packages/web/components/` | React UI (e.g. chat under `components/chat/`, panels under `components/panels/`) |
| `packages/web/hooks/` | Client hooks (`useSyncData`, branch/repo state, execution polling) |

When in doubt, **AGENTS.md** for procedures, **README.md** for product and repo-wide behavior.
