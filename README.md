# Stacks Quest 🎮

A daily on-chain puzzle game built on the Stacks blockchain. Players guess real Stacks blockchain data, bet tokens, and earn rewards.

## How it works

Each day a new puzzle is created with a question about real Stacks blockchain data (block height, tx count, STX price, stakers). Players submit a guess and a bet in their token of choice. Winners split the reward pool for their token.

- 1 guess per player per day
- Bet between 1 and 100 tokens (or 0.00001–0.001 sBTC)
- Correct guesses (within tolerance %) win a share of the reward pool + their bet back
- Separate reward pools per token — STX, $B2S, USDCx, sBTC
- Streak tracking and lifetime stats per player

## Smart Contract

- **Network:** Stacks Mainnet
- **Contract:** `SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.stacks-quest-v2`
- **Clarity version:** 3
- **Epoch:** 3.2
- **Explorer:** [View on Hiro Explorer](https://explorer.hiro.so/address/SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.stacks-quest-v2?chain=mainnet)

## Supported Tokens

| Token | Contract | Min Bet | Max Bet |
|-------|----------|---------|---------|
| STX | native | 1 STX | 100 STX |
| $B2S | [b2s-token-v4](https://explorer.hiro.so/address/SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.b2s-token-v4?chain=mainnet) | 1 B2S | 100 B2S |
| USDCx | SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx | 1 USDC | 100 USDC |
| sBTC | SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token | 0.00001 sBTC | 0.001 sBTC |

## Tech Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Blockchain:** Stacks, Clarity 3
- **Wallet:** Leather wallet integration
- **Tooling:** Clarinet 3.8

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Contract Development

```bash
# Check contracts
clarinet check

# Run tests
npm test

# Generate mainnet deployment plan
clarinet deployments generate --mainnet

# Apply deployment plan
clarinet deployments apply --deployment-plan-path "deployments/default.mainnet-plan.yaml"
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N
NEXT_PUBLIC_CONTRACT_NAME=stacks-quest-v2
```

## Creating a Daily Puzzle (owner only)

```clarity
(contract-call? 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.stacks-quest-v2
  create-puzzle
  "block-height"  ;; puzzle-type (string-ascii 20)
  u850000         ;; answer
  u5              ;; tolerance % (5 = within 5%)
  u10000000       ;; pool-stx   (10 STX,   6 decimals)
  u10000000       ;; pool-b2s   (10 B2S,   6 decimals)
  u0              ;; pool-usdcx
  u0              ;; pool-sbtc
)
```

## Changelog

### v2 — Multi-Token Support
- Added support for STX, $B2S, USDCx, and sBTC bets
- Separate reward pools per token per day
- Winners paid back in the same token they bet
- Migrated to `stacks-block-height` (post-Nakamoto / epoch 3.2)
- Fixed token contract address resolution

### v1
- Initial deployment with $B2S only

## License

MIT

---

Built with ❤️ by [wkalidev](https://github.com/wkalidev) (zcodebase) for [#StacksBuilderRewards](https://twitter.com/willycodexwar/StacksBuilderRewards) May 2026 🏆