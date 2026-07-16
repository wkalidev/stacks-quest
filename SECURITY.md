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

## Known Game-Design Limitation — Puzzle Answers Are Public On-Chain

`create-puzzle` / `createPuzzle` store the puzzle `answer` in a **public** map/struct
(`stacks-quest.clar`, `stacks-quest-v2.clar`, `QuestGame.sol`). Anyone can read it back via
`get-today-puzzle` / `puzzles(dayId)` — a plain read-only call, no payment or signature
required — immediately after the owner posts the day's puzzle, well before `reveal-answer`
is called. This means a player who queries the contract directly (bypassing the app's hint
UI) can submit a guaranteed-correct guess and drain that day's reward pool.

This is a design flaw in the contracts themselves, not something that can be patched
without a redeploy: Clarity and Solidity contracts here are not upgradeable/proxied, so
fixing the *already-deployed* mainnet/testnet contracts requires shipping a v3 with a
commit-reveal scheme (store `hash(answer + salt)` at `create-puzzle` time, reveal
`answer + salt` only at `reveal-answer` time, verify the hash before accepting `claim-reward`)
and migrating reward pools to it. Until that ships, keep reward pool sizes small relative to
the cost of running a script that reads `get-today-puzzle` before playing.

## x402 Payment Verification

The `/api/mcp` premium-tool gate now does structural validation of the `X-Payment` header
(`isPaymentPayloadValid` in `app/api/mcp/route.ts`): it must base64/JSON-decode into an
`exact`-scheme, Base-network payload addressed to `PAYMENT_ADDRESS`, for at least
`PRICE_USDC`, within its `validAfter`/`validBefore` window, carrying a signature-shaped
value. This blocks the previous trivial bypass (any non-empty header string was accepted).

It still does **not** verify the EIP-3009 signature or that the transfer settled on-chain —
that requires calling an x402 facilitator's `/verify` and `/settle` endpoints (see
https://x402.org). A caller can still fabricate a well-formed but unsigned/unfunded payload
and pass this check. Wire up facilitator-based settlement before relying on this for real
revenue protection.

## SSRF Protection

`/api/hiro` proxies only whitelisted Hiro API paths. All other paths return 403.
Allowed prefixes: `/v2/info`, `/v2/accounts/`, `/v2/fees/`, `/v2/contracts/call-read/`,
`/extended/v1/address/`, `/extended/v1/tx/`, `/extended/v1/block/`, `/metadata/v1/`.

## Critical Notes

`STACKS_PRIVATE_KEY` and `EVM_PRIVATE_KEY` in `.env` are for deployment scripts only.
They must NEVER be loaded by Next.js at runtime (`NEXT_PUBLIC_` prefix is forbidden for these keys).

x402 payment verification: the current implementation trusts the presence of the `X-Payment` header.
Production deployments should verify the payment proof on-chain via the x402 settlement network.
