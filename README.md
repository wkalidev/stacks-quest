# Stacks Quest

Daily blockchain puzzle game + non-custodial DeFi agent on Stacks (Bitcoin L2).

## Live App

- **Landing:** [https://stacks-quest-ten.vercel.app](https://stacks-quest-ten.vercel.app)
- **Game:** [https://stacks-quest-ten.vercel.app/game](https://stacks-quest-ten.vercel.app/game)
- **Agent:** [https://stacks-quest-ten.vercel.app/agent](https://stacks-quest-ten.vercel.app/agent)

---

## How to Play

Visit [/game](https://stacks-quest-ten.vercel.app/game) to play the daily puzzle.

1. Connect your Leather or Xverse wallet
2. Read today's puzzle (Stacks block height, STX price, or tx count)
3. Enter your numeric guess
4. Choose a token (STX, $B2S, USDCx, or sBTC) and bet amount (1–100)
5. Submit — you get a hot / warm / cold hint immediately
6. Winners split the daily reward pool for their token
7. Hit the check-in button daily to build your streak and earn bonus rewards

## Daily Puzzle Mechanics

Each day a new puzzle is posted about real Stacks blockchain data. Players submit a guess + bet. Winners split the reward pool for their token.

- 1 guess per player per day
- Bet 1–100 STX / $B2S / USDCx, or 0.00001–0.001 sBTC
- Correct guesses (within tolerance %) win a share of the pool + bet back
- Separate pools per token: STX · $B2S · USDCx · sBTC
- Hot / warm / cold hint after each guess
- Wordle-style social sharing after result (Twitter + Farcaster)

---

## DeFi Agent

Natural language AI powered by Groq (llama-3.3-70b-versatile). 100% non-custodial — user always signs their own transactions.

### Supported Languages

EN · FR · ES · ZH · AR · PT

### DEX Routing

| Pair | DEX |
|------|-----|
| STX / $B2S | Velar DEX |
| STX / USDCx | Velar DEX |
| STX / WELSH | Velar DEX |
| STX / sBTC | Alex DEX |
| STX / ALEX | Alex DEX |

### Supported Tokens

| Token | Contract | Decimals |
|-------|----------|----------|
| STX | native | 6 |
| sBTC | SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token | 8 |
| $B2S | SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.b2s-token-v4 | 6 |
| USDCx | SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx | 6 |
| ALEX | SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex | 8 |
| WELSH | SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token | 6 |

---

## MCP Server

**Endpoint:** `https://stacks-quest-ten.vercel.app/api/mcp`

| Tool | Description |
|------|-------------|
| `get_daily_puzzle` | Today's puzzle number, token pools, bet range |
| `get_player_stats` | Player streak, total guesses, wins, earnings |
| `get_agent_info` | Agent capabilities, DEX routing table, languages |
| `get_staking_options` | Best staking options on Stacks with APY and risk |
| `get_swap_routes` | Recommended DEX for a given token pair |
| `get_checkin_info` | Daily check-in cost, streak bonus schedule |
| `get_network_stats` | Live Stacks block height, mempool, network info |

---

## A2A Agent Card

**Endpoint:** `https://stacks-quest-ten.vercel.app/api/agent-card`
**Well-known:** `https://stacks-quest-ten.vercel.app/.well-known/agent-card.json`

| Skill | Description |
|-------|-------------|
| `daily_puzzle` | Guess blockchain data, bet tokens, win pool |
| `swap` | Route via Velar DEX or Alex DEX |
| `bridge` | Base Network → Stacks via Base2Stacks |
| `checkin` | 0.001 STX daily, streak bonuses at 7/30/100 days |
| `portfolio` | Real-time balances for all supported tokens |
| `staking_info` | APY options and risk info across protocols |

---

## Social Sharing

After a puzzle result, share your score Wordle-style:

```
🔥 Stacks Quest Daily #20254
🔥 Streak: 12 days
👉 stacks-quest-ten.vercel.app
#StacksQuest #Bitcoin #Stacks
```

Share buttons appear automatically after hot / warm / cold results.

---

## Smart Contracts

**Owner:** `SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N`

| Contract | Description |
|----------|-------------|
| `stacks-quest-v2` | Daily puzzle — multi-token bets, reward pools |
| `stacks-quest-agent-v3` | Daily check-in (0.001 STX), streak, agent log |
| `b2s-token-v4` | $B2S SIP-010 token |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript |
| Styling | Tailwind CSS |
| AI Agent | Groq (llama-3.3-70b-versatile) |
| Blockchain | Stacks, Clarity 3, Epoch 3.2 |
| Wallets | Leather, Xverse |
| DEX | Velar DEX, Alex DEX |
| Bridge | Base2Stacks |
| Tooling | Clarinet |
| Deployment | Vercel |

---

## Environment Variables

```env
GROQ_API=your_groq_api_key
NEXT_PUBLIC_CONTRACT_ADDRESS=SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N
NEXT_PUBLIC_CONTRACT_NAME=stacks-quest-v2
NEXT_PUBLIC_BASE_URL=https://stacks-quest-ten.vercel.app
# For deploy scripts only — NEVER expose in Next.js
STACKS_PRIVATE_KEY=your_private_key
```

---

## Quick Start

```bash
git clone https://github.com/wkalidev/stacks-quest.git
cd stacks-quest
npm install
cp .env .env.local  # fill in your keys
npm run dev
```

---

## Multichain Roadmap

Coming soon:

| Chain | Status |
|-------|--------|
| Stacks | ✅ Live |
| Base | 🔜 Coming soon |
| Celo | 🔜 Coming soon |

---

## Stacks Builder Rewards

Stacks Quest is an active participant in [Stacks Builder Rewards](https://stacks.co/builder-rewards).

Every game guess, check-in, and agent swap is a real on-chain transaction on Stacks — driving genuine L2 activity on Bitcoin.

---

## Related Projects

- [Base2Stacks Tracker](https://base2stacks-tracker.vercel.app) — Full DeFi platform, bridge, staking, NFTs
- [@wkalidev/b2s-contracts](https://www.npmjs.com/package/@wkalidev/b2s-contracts) — npm SDK for contracts

---

**Built by [wkalidev (zcodebase)](https://github.com/wkalidev) for Stacks Builder Rewards 2026**
