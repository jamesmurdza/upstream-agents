# Simple Chat

A Next.js chat application for interacting with AI coding agents in isolated Daytona sandboxes. Each chat session is tied to a Git branch, enabling safe code experimentation and collaboration.

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

## Usage

1. **Start a new chat**: Click the "+" button in the sidebar to create a new chat session

2. **Select a repository** (optional): Click the repository selector to link a GitHub repository, or leave it as a new local repo

3. **Choose an agent**: Select your preferred AI coding agent from the dropdown

4. **Configure API keys**: In Settings, add API keys for the models you want to use

5. **Send messages**: Type your coding request and the agent will work in an isolated sandbox

## Project Structure

```
simple-chat/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes
│   │   ├── agent/         # Agent execution and status
│   │   ├── auth/          # NextAuth authentication
│   │   ├── chat/          # Chat utilities (name suggestions)
│   │   ├── git/           # Git operations (push)
│   │   └── sandbox/       # Sandbox creation/deletion
│   ├── page.tsx           # Main chat page
│   └── sdk/               # SDK documentation page
├── components/            # React components
│   ├── ChatPanel.tsx      # Main chat interface
│   ├── MessageBubble.tsx  # Message display
│   ├── Sidebar.tsx        # Chat list sidebar
│   └── modals/            # Settings and repo picker modals
├── lib/                   # Utilities and hooks
│   ├── agent-session.ts   # Agent session management
│   ├── auth.ts            # NextAuth configuration
│   ├── hooks/             # React hooks
│   ├── storage.ts         # Local storage helpers
│   └── types.ts           # TypeScript types
└── e2e/                   # Playwright E2E tests
```

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
- **Agent SDK**: Uses `@upstream/agents` for agent session management
- **Sandbox**: Daytona SDK for isolated development environments
- **State Management**: Local storage with React hooks for persistence
