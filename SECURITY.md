# Security

## Sensitive Variables

| Variable | Location | Risk if leaked |
|----------|----------|----------------|
| `GROQ_API_KEY` | Server-side only | Cost abuse — HIGH |
| `STACKS_PRIVATE_KEY` | Scripts only, never in Next.js | Fund loss — CRITICAL |
| `EVM_PRIVATE_KEY` | Scripts only, never in Next.js | Fund loss — CRITICAL |
| `PAYMENT_ADDRESS` | Server-side only | Misdirected payments — MEDIUM |

## Reporting Vulnerabilities

Please report security issues privately via GitHub private issue or email.
Do NOT open public issues for security vulnerabilities.

## Known Limitations

- Agent routes are rate limited to 10 requests/minute per IP (in-memory, resets on server restart)
- MCP server tools marked as premium require x402 payment header (X-Payment) on Base Network
- Bridge and swap actions require user to sign their own transactions — non-custodial
- In-memory rate limiter is per-instance; not shared across Vercel serverless function instances

## SSRF Protection

`/api/hiro` proxies only whitelisted Hiro API paths. All other paths return 403.
Allowed prefixes: `/v2/info`, `/v2/accounts/`, `/v2/fees/`, `/v2/contracts/call-read/`,
`/extended/v1/address/`, `/extended/v1/tx/`, `/extended/v1/block/`, `/metadata/v1/`.

## Critical Notes

`STACKS_PRIVATE_KEY` and `EVM_PRIVATE_KEY` in `.env` are for deployment scripts only.
They must NEVER be loaded by Next.js at runtime (`NEXT_PUBLIC_` prefix is forbidden for these keys).

x402 payment verification: the current implementation trusts the presence of the `X-Payment` header.
Production deployments should verify the payment proof on-chain via the x402 settlement network.
