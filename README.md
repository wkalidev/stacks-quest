# Stacks Quest 🎮

A daily on-chain puzzle game + non-custodial crypto agent built on the Stacks blockchain (Bitcoin L2). Players guess real Stacks blockchain data, bet tokens, earn rewards, and interact with DeFi via a natural language AI agent.

## Live App

- **Game:** [stacks-quest-ten.vercel.app](https://stacks-quest-ten.vercel.app)
- **Agent:** [stacks-quest-ten.vercel.app/agent](https://stacks-quest-ten.vercel.app/agent)

## Features

### Daily Puzzle Game
Each day a new puzzle is created with a question about real Stacks blockchain data (block height, tx count, STX price, stakers). Players submit a guess and a bet in their token of choice. Winners split the reward pool for their token.

- 1 guess per player per day
- Bet between 1 and 100 tokens (or 0.00001–0.001 sBTC)
- Correct guesses (within tolerance %) win a share of the reward pool + their bet back
- Separate reward pools per token — STX, $B2S, USDCx, sBTC
- Streak tracking and lifetime stats per player
- Hot/warm/cold hint system after each guess

### Stacks Agent (non-custodial)
A natural language AI agent powered by Groq (LLama 3.3 70B) that helps users interact with Stacks DeFi — all non-custodial, user always signs their own transactions.

- **Chat:** Ask to swap, bridge, or query portfolio in plain English
- **Swap routing:** STX/$B2S, STX/USDCx → Velar DEX | STX/sBTC, STX/ALEX → Alex DEX
- **Bridge:** Base Network → Stacks via Base2Stacks bridge
- **Portfolio:** Real-time balances for STX, sBTC, $B2S, USDCx, ALEX, WELSH
- **Daily check-in:** 0.001 STX fee, builds streak, earns rewards
- **Streak bonuses:** +0.002 STX at 7 days, +0.01 STX at 30 days, +0.05 STX at 100 days

## Smart Contracts

| Contract | Address | Description |
|----------|---------|-------------|
| stacks-quest-v2 | [SP1V72...KBQ5N.stacks-quest-v2](https://explorer.hiro.so/address/SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.stacks-quest-v2?chain=mainnet) | Daily puzzle game, multi-token |
| stacks-quest-agent-v3 | [SP1V72...KBQ5N.stacks-quest-agent-v3](https://explorer.hiro.so/address/SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.stacks-quest-agent-v3?chain=mainnet) | Daily check-in + agent action log |

- **Network:** Stacks Mainnet
- **Clarity version:** 3 (epoch 3.2)

## Supported Tokens

| Token | Contract | Min Bet | Max Bet |
|-------|----------|---------|---------|
| STX | native | 1 STX | 100 STX |
| $B2S | [b2s-token-v4](https://explorer.hiro.so/address/SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.b2s-token-v4?chain=mainnet) | 1 B2S | 100 B2S |
| USDCx | SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx | 1 USDC | 100 USDC |
| sBTC | SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token | 0.00001 sBTC | 0.001 sBTC |

## Tech Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS
- **AI Agent:** Groq API (LLama 3.3 70B)
- **Blockchain:** Stacks, Clarity 3, Epoch 3.2
- **Wallets:** Leather, Xverse
- **DEX:** Velar, Alex DEX
- **Bridge:** Base2Stacks (base2stacks-tracker.vercel.app)
- **Tooling:** Clarinet

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables

```env
GROQ_API=your_groq_api_key
NEXT_PUBLIC_CONTRACT_ADDRESS=SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N
NEXT_PUBLIC_CONTRACT_NAME=stacks-quest-v2
```

## Contract Development

```bash
# Check contracts
clarinet check

# Deploy to mainnet
node scripts/deploy-agent.mjs
```

## Creating a Daily Puzzle (owner only)

```clarity
(contract-call? 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.stacks-quest-v2
  create-puzzle
  "block-height"
  u850000
  u5
  u10000000
  u10000000
  u0
  u0
)
```

## Changelog

### Agent v3 — Non-Custodial Crypto Agent
- Daily check-in system (0.001 STX fee)
- Streak tracking with bonuses at 7/30/100 days
- Agent action log on-chain
- Groq AI chat for natural language DeFi interactions
- Portfolio dashboard with real-time balances
- Swap routing to Velar and Alex DEX
- Cross-chain bridge integration (Base → Stacks)

### Quest v2 — Multi-Token Support
- Added STX, $B2S, USDCx, sBTC bets
- Separate reward pools per token per day
- Hot/warm/cold hint system
- Migrated to stacks-block-height (post-Nakamoto)
- Streak tracking and lifetime stats

### Quest v1
- Initial deployment with $B2S only

## License

MIT

---

Built with love by [wkalidev](https://github.com/wkalidev) (zcodebase) for [#StacksBuilderRewards](https://twitter.com/willycodexwar) 2026