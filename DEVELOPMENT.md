# Development Setup

This guide explains how to run Upstream Agents locally for development.

## Prerequisites

- Node.js 20+
- PostgreSQL (local or Docker)
- A GitHub account

## Required Environment Variables

For local development, you only need **two** environment variables:

| Variable | Description | How to get it |
|----------|-------------|---------------|
| `GITHUB_PAT` | GitHub Personal Access Token | [Create one here](https://github.com/settings/tokens) with scopes: `repo`, `read:user` |
| `DAYTONA_API_KEY` | Daytona API key for sandboxes | Get from [Daytona](https://www.daytona.io/) |

When `GITHUB_PAT` is set:
- The login page auto-creates a session and redirects to the app
- No GitHub OAuth app needed
- A dev user is auto-created in the database
- The PAT is used for all GitHub operations

## Quick Start

### 1. Install PostgreSQL

**Ubuntu/Debian:**
```bash
sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib
sudo service postgresql start
```

**macOS:**
```bash
brew install postgresql@17
brew services start postgresql@17
```

### 2. Create the Database

```bash
# Create user and database
sudo -u postgres psql -c "CREATE USER sandboxed WITH PASSWORD 'sandboxed123';"
sudo -u postgres psql -c "CREATE DATABASE sandboxed_agents OWNER sandboxed;"
```

### 3. Configure Environment

Create a `.env` file in `packages/web/`:

```bash
# Database (Local PostgreSQL)
DATABASE_URL="postgresql://sandboxed:sandboxed123@localhost:5432/sandboxed_agents"
DATABASE_URL_UNPOOLED="postgresql://sandboxed:sandboxed123@localhost:5432/sandboxed_agents"

# NextAuth - IMPORTANT: Set to your actual URL, not localhost!
# - Local dev: http://localhost:3000
# - Daytona: https://{port}-{sandbox-id}.daytonaproxy01.net
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-not-used-in-dev-mode"

# GitHub OAuth (placeholder - not used when GITHUB_PAT is set)
GITHUB_CLIENT_ID="placeholder"
GITHUB_CLIENT_SECRET="placeholder"

# Encryption key for credentials
ENCRYPTION_KEY="0000000000000000000000000000000000000000000000000000000000000000"

# === REQUIRED FOR DEVELOPMENT ===
GITHUB_PAT=ghp_your_token_here
DAYTONA_API_KEY=dtn_your_key_here

# Optional
SMITHERY_API_KEY="placeholder"
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Initialize the Database

```bash
npx prisma db push
```

### 6. Start the Development Server

```bash
npm run dev
```

The app will be available at http://localhost:3000

## What Happens on First Visit

When you visit the app with `GITHUB_PAT` set:

1. The login page detects dev mode and auto-redirects
2. A session is created for the dev user
3. A warning is logged: `WARNING: Running in dev mode (GITHUB_PAT is set)`
4. A dev user is auto-created in the database with:
   - Admin privileges
   - 100 sandbox quota
   - Default credentials

You'll be logged in automatically — no OAuth flow needed.

## Verifying It Works

Test the API:
```bash
# Should return quota info
curl http://localhost:3000/api/user/quota

# Should return your GitHub repos (requires valid PAT)
curl http://localhost:3000/api/github/repos
```

## Troubleshooting

### "Can't reach database server"
Make sure PostgreSQL is running:
```bash
sudo service postgresql status
# If not running:
sudo service postgresql start
```

### "GitHub account not linked" or GitHub API errors
Your `GITHUB_PAT` is missing or invalid. Make sure:
- The token has `repo` and `read:user` scopes
- The token hasn't expired

### Prisma errors about adapters
Clear the Next.js cache and restart:
```bash
rm -rf .next
npm run dev
```

## Notes

- `GITHUB_PAT` mode is **disabled in production** (`NODE_ENV=production`)
- The dev user has a fixed ID: `dev-user-00000000-0000-0000-0000-000000000000`
- All data is isolated to your local database
