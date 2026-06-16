# Security

## Sensitive Variables

| Variable | Location | Risk if leaked |
|----------|----------|----------------|
| `GROQ_API` | Server-side only | AI cost abuse — HIGH |
| `STACKS_PRIVATE_KEY` | Scripts only, never in Next.js | Fund loss — CRITICAL |
| `HIRO_API_KEY` (if added) | Server-side only | Rate limit bypass — MEDIUM |

## Reporting Vulnerabilities

Please report security issues privately via GitHub private issue or email.
Do NOT open public issues for security vulnerabilities.

## Known Limitations

- Agent routes are rate limited to 10 requests/minute per IP (in-memory, resets on server restart)
- No authentication required to call the MCP server (public API by design)
- Bridge and swap actions require user to sign their own transactions — non-custodial
- In-memory rate limiter is per-instance; not shared across Vercel serverless function instances

## Critical Note

`STACKS_PRIVATE_KEY` in `.env` is for deployment scripts only (`scripts/deploy-agent.mjs`).
It must NEVER be loaded by Next.js at runtime (`NEXT_PUBLIC_` prefix is forbidden for this key).
