# Background Execution Method Tests

These tests compare different Daytona SDK methods for running AI coding agents asynchronously in the background.

## Directory Structure

```
background-methods/
├── codex/           # OpenAI Codex tests
│   ├── 01-ssh.ts
│   ├── 02-execute-command.ts
│   ├── 03-session-command.ts
│   └── 04-pty.ts
├── claude/          # Anthropic Claude Code tests
│   ├── 01-ssh.ts
│   ├── 02-execute-command.ts
│   ├── 03-session-command.ts
│   └── 04-pty.ts
├── opencode/        # OpenCode tests
│   ├── 01-ssh.ts
│   ├── 02-execute-command.ts
│   ├── 03-session-command.ts
│   └── 04-pty.ts
├── run-all.sh       # Runner script
└── README.md
```

## Prerequisites

Set the required environment variables:

```bash
export DAYTONA_API_KEY="your-daytona-api-key"

# For Codex tests:
export OPENAI_API_KEY="your-openai-api-key"

# For Claude tests:
export TEST_ANTHROPIC_API_KEY="your-anthropic-api-key"

# For OpenCode tests (uses Anthropic by default):
export TEST_ANTHROPIC_API_KEY="your-anthropic-api-key"
```

## Running Tests

```bash
# Run all tests for a specific provider
./run-all.sh codex
./run-all.sh claude
./run-all.sh opencode

# Run a specific test method for a provider
./run-all.sh codex 1    # SSH method
./run-all.sh claude 2   # executeCommand method
./run-all.sh opencode 3 # executeSessionCommand method

# Run all providers, all methods
./run-all.sh all
```

## Methods Compared

### 1. SSH + nohup (`01-ssh.ts`)
Uses SSH to connect to the sandbox and launch the process with `nohup`. Returns immediately with PID.

**Pros:**
- Process fully detached from connection
- Survives SSH disconnect
- Direct PID for tracking

**Cons:**
- Requires `ssh2` dependency
- Extra setup (SSH access token)

### 2. executeCommand (`02-execute-command.ts`)
Uses the standard process API with shell backgrounding (`&` and `nohup`).

**Pros:**
- No extra dependencies
- Simple API

**Cons:**
- May have edge cases with process groups

### 3. executeSessionCommand (`03-session-command.ts`)
Uses session-based execution with `runAsync: true`.

**Pros:**
- Native async support
- Returns `cmdId` for tracking
- Session maintains environment

**Cons:**
- Need to manage session lifecycle

### 4. PTY (`04-pty.ts`)
Uses pseudo-terminal sessions with disconnect/reconnect pattern.

**Pros:**
- Interactive terminal access
- Can send Ctrl+C
- Session persists

**Cons:**
- More complex setup
- Output mixed with shell prompts

## Features Tested

Each test verifies:

1. **Async Launch** - Command returns immediately without blocking
2. **Check Running** - Can verify if process is still running (`kill -0 PID`)
3. **Kill Process** - Can terminate the process early (process group kill + pkill fallback)

## Results Summary

| Method | Launch Time | Async | Check | Kill |
|--------|-------------|-------|-------|------|
| SSH | ~100ms | ✅ | ✅ | ✅ |
| executeCommand | ~50ms | ✅ | ✅ | ✅ |
| executeSessionCommand | ~30ms | ✅ | ✅ | ✅ |
| PTY | ~1ms | ✅ | ✅ | ✅ |

All methods support async execution, process monitoring, and termination.
