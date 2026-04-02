# JSONL Reference Files

Raw JSONL output captured from actual AI coding agent CLI runs. These are **not normalized** - they show the native output format of each provider exactly as the CLI produces it.

## Regenerating

```bash
npm run generate:jsonl-refs
```

Requires `DAYTONA_API_KEY` and provider-specific API keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`).
