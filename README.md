# Stacks Quest 🎮

A daily on-chain puzzle game built on the Stacks blockchain. Players guess real Stacks blockchain data, bet $B2S tokens, and earn rewards.

## How it works

Each day a new puzzle is created with a question about real Stacks blockchain data (block height, tx count, STX price, stakers). Players submit a guess and a $B2S bet. Winners split the reward pool.

- 1 guess per player per day
- Bet between 1 and 100 $B2S
- Correct guesses (within tolerance) win a share of the reward pool + their bet back
- Streak tracking and lifetime stats per player

## Smart Contract

- **Network:** Stacks Mainnet
- **Contract:** `SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.stacks-quest`
- **Clarity version:** 3
- **Epoch:** 3.2
- **Token:** [$B2S](https://explorer.hiro.so/address/SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.b2s-token-v4?chain=mainnet)

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
# Check contract
clarinet check

# Run tests
npm test

# Deploy to mainnet
clarinet deployments generate --mainnet --low-cost
clarinet deployments apply --mainnet
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_CONTRACT_ADDRESS=SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N
NEXT_PUBLIC_CONTRACT_NAME=stacks-quest
```

## License

MIT