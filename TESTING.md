# Testing procedures

This document describes the procedures for running the tests and the development server.

The structure of this document begins with the simplest setup required and progresses to the most complex.

**Note:** PostgreSQL install commands below are for **Linux** (Debian/Ubuntu-style). Adapt for other OSes.

---

## Unit tests

Unit tests need no database and no env files.

Run the command below from the repo root.

```bash
npm run test -w @upstream/agents
```

---

## Database setup

You need a Postgres database for Playwright and for the development server below.

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

---

## Development server

Prerequisites: Node.js 20+ and the Postgres database from [Database setup](#database-setup).

**Secrets:** You need a GitHub [Personal Access Token](https://github.com/settings/tokens) with scopes `repo` and `read:user` (`GITHUB_PAT`), and a [Daytona](https://www.daytona.io/) API key (`DAYTONA_API_KEY`).

**Note:** In a sandbox environment, take `DAYTONA_API_KEY` and `GITHUB_PAT` from the shell environment variables.

**Database:** Put `DATABASE_URL` and `DATABASE_URL_UNPOOLED` in `packages/web/.env` (same values as in [Database setup](#database-setup), or your provider’s URLs).

**Minimal `packages/web/.env`:** Fill in database URLs, then set the rest. With `GITHUB_PAT` set, GitHub OAuth placeholders are not used; they can stay as shown.

```bash
DATABASE_URL="postgresql://sandboxed:sandboxed123@localhost:5432/sandboxed_agents"
DATABASE_URL_UNPOOLED="postgresql://sandboxed:sandboxed123@localhost:5432/sandboxed_agents"

# Local dev: http://localhost:3000. Behind Daytona proxy: https://3000-{sandbox-id}.daytonaproxy01.net
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-not-used-in-dev-mode"

GITHUB_CLIENT_ID="placeholder"
GITHUB_CLIENT_SECRET="placeholder"

ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000"

GITHUB_PAT=ghp_your_token_here
DAYTONA_API_KEY=dtn_your_key_here
```

If the app is served behind a Daytona proxy, `NEXTAUTH_URL` must be that public URL (not `http://localhost:3000`). NextAuth validates requests against this value.

With `GITHUB_PAT` set you get auto-login at http://localhost:3000—no GitHub OAuth app required. The first visit creates a dev user in the database and logs a warning that dev mode is active.

The first time you work in the repo, from the repo root run `npm install` and `npm run build:sdk`, then apply the schema ([Database setup](#database-setup)) if you have not already.

Run the command below from the repo root.

```bash
npm run dev
```
