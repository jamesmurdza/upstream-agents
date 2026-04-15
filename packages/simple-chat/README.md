# Simple Chat

A Next.js chat application for interacting with AI coding agents in isolated Daytona sandboxes. Each chat session is tied to a Git branch, enabling safe code experimentation and collaboration.

https://github.com/user-attachments/assets/d3a10c97-8a23-4171-a08f-c08179b419d6

## Features

- **Multi-Agent Support**: Choose from multiple AI coding agents:
  - Claude Code
  - OpenCode
  - Codex
  - Gemini
  - Goose
  - Pi

- **Sandbox Isolation**: Each chat session runs in an isolated Daytona sandbox environment

- **Git Integration**: Conversations are tied to Git branches, with optional GitHub repository integration

- **Model Selection**: Choose different models for each agent based on your API keys

- **Dark/Light Theme**: System-aware theming with manual override options

## Prerequisites

- Node.js 18+
- A Daytona API key (from [Daytona dashboard](https://www.daytona.io/))
- API keys for the AI providers you want to use (Anthropic, OpenAI, Google, etc.)
- GitHub OAuth app (optional, for GitHub repository integration)

## Setup

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Configure environment variables**:

   Copy the example environment file and fill in your values:

   ```bash
   cp .env.example .env
   ```

   Required variables:
   - `DAYTONA_API_KEY` - Your Daytona API key
   - `NEXTAUTH_SECRET` - A random secret for NextAuth session encryption
   - `NEXTAUTH_URL` - Your app URL (default: `http://localhost:4000`)

   Optional (for GitHub integration):
   - `GITHUB_CLIENT_ID` - GitHub OAuth app client ID
   - `GITHUB_CLIENT_SECRET` - GitHub OAuth app client secret

3. **Start the development server**:

   ```bash
   npm run dev
   ```

   The app will be available at http://localhost:4000

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server on port 4000 |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Run Playwright tests with UI |

## Architecture

- **Frontend**: Next.js 16 with React 19, Tailwind CSS 4, and Radix UI primitives
- **Authentication**: NextAuth.js with GitHub OAuth provider
- **Agent SDK**: Uses `background-agents` for agent session management
- **Sandbox**: Daytona SDK for isolated development environments
- **State Management**: Local storage with React hooks for persistence
