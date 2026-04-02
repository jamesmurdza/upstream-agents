# Testing procedures

This document describes how to run unit tests and Playwright end-to-end tests.

The structure begins with the simplest setup and progresses to the more involved one.

**Note:** PostgreSQL install commands below are for **Linux** (Debian/Ubuntu-style). Adapt for other OSes.

---

## Unit tests

Unit tests need no database and no env files.

Run the command below from the repo root.

```bash
npm run test -w @upstream/agents
```

---

## Agent SDK integration tests

Integration tests run each provider (Claude, Codex, Gemini, OpenCode) in real Daytona sandboxes. Tests are skipped when required API keys are not set.

Run the command below from the repo root.

```bash
DAYTONA_API_KEY=... ANTHROPIC_API_KEY=... OPENAI_API_KEY=... GEMINI_API_KEY=... \
  npm test -w @upstream/agents -- tests/integration
```

---

## Database setup

You need a Postgres database for Playwright below.

Set up a local database by running the commands below.

```bash
sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib
sudo service postgresql start
sudo -u postgres psql -c "CREATE USER sandboxed WITH PASSWORD 'sandboxed123';"
sudo -u postgres psql -c "CREATE DATABASE sandboxed_agents OWNER sandboxed;"
```

Example connection strings for that local setup:

```text
DATABASE_URL="postgresql://sandboxed:sandboxed123@localhost:5432/sandboxed_agents"
DATABASE_URL_UNPOOLED="postgresql://sandboxed:sandboxed123@localhost:5432/sandboxed_agents"
```

When the schema changes, apply it by running the command below from `packages/web`:

```bash
DATABASE_URL="<same as the DATABASE_URL you configured>" npx prisma db push
```

---

## Playwright end-to-end tests

**Secrets:** In the **repo root** `.env`, you only need `DAYTONA_API_KEY` (`packages/web/playwright.config.ts` loads it).

**Note:** In a sandbox environment, take the `DAYTONA_API_KEY` from the shell environment variables.

**Database:** Use a database from [Database setup](#database-setup). Prefer a **separate** database from your dev DB so E2E does not overwrite local data. In `packages/web/.env.e2e`, set `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (same value is fine), `NEXTAUTH_SECRET`, and `ENCRYPTION_KEY`.

Run the command below from `packages/web`.

```bash
npm run test:e2e
```
