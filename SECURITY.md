# Security

## Sensitive Variables

| Variable | Location | Risk if leaked |
|----------|----------|----------------|
| `GROQ_API_KEY` | Server-side only | Cost abuse — HIGH |
| `STACKS_PRIVATE_KEY` | Scripts only, never in Next.js | Fund loss — CRITICAL |
| `EVM_PRIVATE_KEY` | Scripts only, never in Next.js | Fund loss — CRITICAL |
| `PAYMENT_ADDRESS` | Server-side only | Misdirected payments — MEDIUM |
| `X402_FACILITATOR_API_KEY` | Server-side only | Facilitator account abuse — MEDIUM |

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

The `/api/mcp` premium-tool gate does two layers of checking, both in `app/api/mcp/route.ts`:

1. **Structural validation** (`isPaymentPayloadValid`): the `X-Payment` header must
   base64/JSON-decode into an `exact`-scheme, Base-network payload addressed to
   `PAYMENT_ADDRESS`, for at least `PRICE_USDC`, within its `validAfter`/`validBefore`
   window, carrying a signature-shaped value. Blocks trivial/garbage headers.
2. **Facilitator verify + settle** (`facilitatorVerifyAndSettle`): calls a real x402
   facilitator's `/verify` then `/settle` endpoints so the request must carry an
   actually-valid EIP-3009 signature and the USDC transfer must actually settle on Base
   before a premium tool is served. Configured via `X402_FACILITATOR_URL` /
   `X402_FACILITATOR_API_KEY` (defaults to the public reference facilitator at
   https://x402.org if unset).

**Fail-open by default**: if the facilitator is unreachable (network error, timeout, 5xx),
the gate falls back to structural-only validation rather than blocking all premium traffic —
set `X402_STRICT_FACILITATOR=true` to fail closed instead once a funded, reliable production
facilitator is wired up. **Not live-tested**: this sandbox has no outbound network access to
x402.org, so `facilitatorVerifyAndSettle` has only been verified for syntax/type-correctness,
not against a real signed payment. Test against a real facilitator before relying on this for
revenue protection in production.

## SSRF Protection

`/api/hiro` proxies only whitelisted Hiro API paths. All other paths return 403.
Allowed prefixes: `/v2/info`, `/v2/accounts/`, `/v2/fees/`, `/v2/contracts/call-read/`,
`/extended/v1/address/`, `/extended/v1/tx/`, `/extended/v1/block/`, `/metadata/v1/`.

## Critical Notes

`STACKS_PRIVATE_KEY` and `EVM_PRIVATE_KEY` in `.env` are for deployment scripts only.
They must NEVER be loaded by Next.js at runtime (`NEXT_PUBLIC_` prefix is forbidden for these keys).

x402 payment verification: the current implementation trusts the presence of the `X-Payment` header.
Production deployments should verify the payment proof on-chain via the x402 settlement network.
