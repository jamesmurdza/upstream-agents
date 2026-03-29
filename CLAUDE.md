# Claude Instructions

## Daytona Sandbox Environment

When running inside a Daytona sandbox:

### Environment Variables
`GITHUB_PAT` and `DAYTONA_API_KEY` are already set in the environment — don't add them to `.env`. Only add local-specific config (database URL, NextAuth settings, etc.) to `.env`.

**CRITICAL:** Set `NEXTAUTH_URL` to the Daytona proxy URL. Using `localhost:3000` will cause redirect errors:
```
NEXTAUTH_URL="https://{port}-{sandbox-id}.daytonaproxy01.net"
```

### Preview URL
The app is accessible via the Daytona proxy URL pattern:
```
https://{port}-{sandbox-id}.daytonaproxy01.net
```

The `allowedDevOrigins` wildcard (`**.daytonaproxy01.net`) in `next.config.mjs` handles this automatically.

### Running Servers
Start web servers with `nohup` so they persist:
```bash
nohup npm run dev > server.log 2>&1 &
```

## Testing

### SDK Unit Tests (No API Keys Required)

```bash
npm run test -w @sandboxed-agents/sdk
```

### SDK Integration Tests (Requires API Keys)

Integration tests require real Daytona sandboxes and AI providers. These are skipped by default unless the required environment variables are set.

```bash
# Run integration tests with Claude
DAYTONA_API_KEY=dtn_... ANTHROPIC_API_KEY=sk-ant-... npm run test -w @sandboxed-agents/sdk -- tests/integration/

# Run all tests including integration
DAYTONA_API_KEY=dtn_... ANTHROPIC_API_KEY=sk-ant-... npm run test -w @sandboxed-agents/sdk
```

### Manual SDK Testing

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

### Debug Mode

Set `CODING_AGENTS_DEBUG=1` to enable verbose logging:

```bash
CODING_AGENTS_DEBUG=1 npx tsx packages/agents/scripts/repl-polling.ts
```

This logs agent lifecycle events, background session details, and unparsed output.
