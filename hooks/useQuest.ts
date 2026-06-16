'use client'

import { useState } from 'react'
import { principalCV, serializeCV } from '@stacks/transactions'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const CONTRACT_NAME    = process.env.NEXT_PUBLIC_CONTRACT_NAME    || 'stacks-quest-v2'
const API              = 'https://api.mainnet.hiro.so'

// ---------------------------------------------------------------------------
// 30-question puzzle bank — Stacks · Bitcoin · Ethereum · Celo · Base · Crypto
// ---------------------------------------------------------------------------
type PuzzleEntry = {
  type: string
  hint: string
  baseQuestion: string
  getAnswer(): Promise<{ answer: number; question?: string } | null>
}

const PUZZLE_BANK: PuzzleEntry[] = [
  // === STACKS (0–5) ===
  {
    type: 'stacks-block-height',
    hint: 'Check explorer.hiro.so — Stacks produces ~1 block every 10 minutes.',
    baseQuestion: 'What is the current Stacks block height?',
    async getAnswer() {
      const r = await fetch('https://api.mainnet.hiro.so/v2/info')
      const d = await r.json()
      const h: number = d.stacks_tip_height
      return { answer: h, question: `What is the current Stacks block height? (hint: it's around ${Math.floor(h / 1000) * 1000})` }
    },
  },
  {
    type: 'stx-price-cents',
    hint: 'Multiply STX/USD price by 100, round to nearest integer. Check CoinGecko or Binance.',
    baseQuestion: 'What is the current STX price in whole USD cents? (e.g. enter 32 for $0.32)',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd')
      const d = await r.json()
      return { answer: Math.round((d.blockstack?.usd ?? 0) * 100) }
    },
  },
  {
    type: 'stacks-puzzle-day',
    hint: 'Divide the current Stacks block height by 144 (blocks per day) and truncate.',
    baseQuestion: 'What is the current Stacks puzzle day ID? (block height ÷ 144)',
    async getAnswer() {
      const r = await fetch('https://api.mainnet.hiro.so/v2/info')
      const d = await r.json()
      const day: number = Math.floor(d.stacks_tip_height / 144)
      return { answer: day, question: `What is the current Stacks puzzle day ID? (block height ÷ 144 ≈ ${day})` }
    },
  },
  {
    type: 'stacks-mempool',
    hint: 'Check mempool.hiro.so — typically 0–500 pending transactions.',
    baseQuestion: 'How many transactions are currently pending in the Stacks mempool?',
    async getAnswer() {
      const r = await fetch('https://api.mainnet.hiro.so/extended/v1/tx/mempool?limit=1')
      const d = await r.json()
      const total: number = d.total ?? 0
      return { answer: total }
    },
  },
  {
    type: 'stx-sats',
    hint: 'Divide STX/USD by BTC/USD, multiply by 100,000,000. E.g. enter 1200 for 1200 sats.',
    baseQuestion: 'What is 1 STX worth in satoshis? (whole number, e.g. enter 1200)',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=blockstack,bitcoin&vs_currencies=usd')
      const d = await r.json()
      const stx: number = d.blockstack?.usd
      const btc: number = d.bitcoin?.usd
      if (!stx || !btc) return null
      return { answer: Math.round((stx / btc) * 1e8) }
    },
  },
  {
    type: 'stx-price-10x',
    hint: 'Multiply STX/USD price by 10, round to the nearest integer.',
    baseQuestion: 'What is the STX price × 10, rounded to the nearest integer? (e.g. enter 3 for $0.30)',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd')
      const d = await r.json()
      return { answer: Math.round((d.blockstack?.usd ?? 0) * 10) }
    },
  },
  // === BITCOIN (6–11) ===
  {
    type: 'btc-block-height',
    hint: 'Check mempool.space or blockstream.info for the live Bitcoin block height.',
    baseQuestion: 'What is the current Bitcoin block height?',
    async getAnswer() {
      const r = await fetch('https://blockstream.info/api/blocks/tip/height')
      const t = await r.text()
      const h = parseInt(t.trim(), 10)
      return { answer: h, question: `What is the current Bitcoin block height? (hint: it's around ${Math.floor(h / 10000) * 10000})` }
    },
  },
  {
    type: 'btc-price-thousands',
    hint: 'Divide BTC/USD by 1,000 and round to nearest integer. E.g. enter 95 for $95,000.',
    baseQuestion: 'What is the BTC price in thousands of USD? (enter 95 for ~$95,000)',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
      const d = await r.json()
      return { answer: Math.round((d.bitcoin?.usd ?? 0) / 1000) }
    },
  },
  {
    type: 'btc-mempool-k',
    hint: 'Check mempool.space — unconfirmed txs divided by 1,000. Usually 1–200.',
    baseQuestion: 'How many transactions are in the Bitcoin mempool? (answer in thousands)',
    async getAnswer() {
      const r = await fetch('https://blockstream.info/api/mempool')
      const d = await r.json()
      return { answer: Math.max(0, Math.round((d.count as number) / 1000)) }
    },
  },
  {
    type: 'btc-halving-era',
    hint: 'Halvings happen every 210,000 blocks. The 4th was at block 840,000 (April 2024).',
    baseQuestion: 'Which Bitcoin halving era are we in? (1=genesis→1st halving, 2=after 1st, 3=after 2nd, etc.)',
    async getAnswer() {
      const r = await fetch('https://blockstream.info/api/blocks/tip/height')
      const t = await r.text()
      const h = parseInt(t.trim(), 10)
      return { answer: Math.floor(h / 210000) + 1 }
    },
  },
  {
    type: 'btc-price-500',
    hint: 'Enter BTC price rounded to the nearest $500 (e.g. enter 95500).',
    baseQuestion: 'What is the current BTC price in USD, rounded to the nearest $500?',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
      const d = await r.json()
      const p: number = d.bitcoin?.usd ?? 0
      return { answer: Math.round(p / 500) * 500 }
    },
  },
  {
    type: 'btc-blocks-to-halving',
    hint: 'Next halving is at block 1,050,000. Subtract current block height, then divide by 1,000.',
    baseQuestion: 'How many Bitcoin blocks remain until the next halving? (answer in thousands)',
    async getAnswer() {
      const r = await fetch('https://blockstream.info/api/blocks/tip/height')
      const t = await r.text()
      const h = parseInt(t.trim(), 10)
      const next = Math.ceil(h / 210000) * 210000
      return { answer: Math.round((next - h) / 1000) }
    },
  },
  // === ETHEREUM (12–15) ===
  {
    type: 'eth-price-usd',
    hint: 'Check any major exchange. ETH is typically between $1,000 and $5,000.',
    baseQuestion: 'What is the current ETH price in whole USD?',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      const d = await r.json()
      return { answer: Math.round(d.ethereum?.usd ?? 0) }
    },
  },
  {
    type: 'eth-gas-gwei',
    hint: 'Check etherscan.io/gastracker — usually 1–100 Gwei.',
    baseQuestion: 'What is the current Ethereum gas price in Gwei? (round to nearest integer)',
    async getAnswer() {
      const r = await fetch('https://eth.llamarpc.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 }),
      })
      const d = await r.json()
      return { answer: Math.max(1, Math.round(parseInt(d.result as string, 16) / 1e9)) }
    },
  },
  {
    type: 'eth-price-hundreds',
    hint: 'Divide ETH/USD by 100, round to nearest integer. E.g. enter 35 for $3,500.',
    baseQuestion: 'What is the ETH price in hundreds of USD? (enter 35 for $3,500)',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      const d = await r.json()
      return { answer: Math.round((d.ethereum?.usd ?? 0) / 100) }
    },
  },
  {
    type: 'eth-sats',
    hint: 'Divide ETH/USD by BTC/USD, multiply by 100,000,000. Result is ETH in satoshis.',
    baseQuestion: 'What is 1 ETH worth in satoshis? (whole number, e.g. enter 3000000)',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin&vs_currencies=usd')
      const d = await r.json()
      const eth: number = d.ethereum?.usd
      const btc: number = d.bitcoin?.usd
      if (!eth || !btc) return null
      return { answer: Math.round((eth / btc) * 1e8) }
    },
  },
  // === CELO (16–18) ===
  {
    type: 'celo-price-cents',
    hint: 'Multiply CELO/USD by 100, round to nearest integer. Check CoinGecko.',
    baseQuestion: 'What is the current CELO price in whole USD cents? (e.g. enter 45 for $0.45)',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd')
      const d = await r.json()
      return { answer: Math.round((d.celo?.usd ?? 0) * 100) }
    },
  },
  {
    type: 'celo-price-tenths',
    hint: 'Multiply CELO/USD by 10, round to nearest integer. E.g. enter 6 for $0.60.',
    baseQuestion: 'What is the CELO price × 10? (enter 6 for $0.60)',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd')
      const d = await r.json()
      return { answer: Math.round((d.celo?.usd ?? 0) * 10) }
    },
  },
  {
    type: 'celo-validators',
    hint: 'Celo uses Proof of Stake with ~100 elected validator groups. Check celostats.org.',
    baseQuestion: 'How many active elected validator groups are on the Celo network? (round to 10)',
    async getAnswer() { return null },
  },
  // === BASE (19–21) ===
  {
    type: 'base-block-millions',
    hint: 'Base produces ~2 blocks/second. Check basescan.org. Answer in millions.',
    baseQuestion: 'What is the current Base Network block number, in millions? (e.g. enter 28 for 28M)',
    async getAnswer() {
      const r = await fetch('https://mainnet.base.org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      })
      const d = await r.json()
      const b = parseInt(d.result as string, 16)
      const m = Math.round(b / 1e6)
      return { answer: m, question: `What is the current Base Network block number, in millions? (hint: around ${m}M)` }
    },
  },
  {
    type: 'base-gas-milli-gwei',
    hint: 'Base gas is ultra cheap — usually under 0.01 Gwei. Enter in units of 0.001 Gwei.',
    baseQuestion: 'What is the Base gas price in units of 0.001 Gwei? (e.g. enter 5 for 0.005 Gwei)',
    async getAnswer() {
      const r = await fetch('https://mainnet.base.org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_gasPrice', params: [], id: 1 }),
      })
      const d = await r.json()
      return { answer: Math.max(1, Math.round(parseInt(d.result as string, 16) / 1e6)) }
    },
  },
  {
    type: 'base-eth-price',
    hint: 'ETH is the native gas token on Base — same price as Ethereum ETH. Check any exchange.',
    baseQuestion: 'What is the current ETH price on Base (same as Ethereum ETH), in whole USD?',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd')
      const d = await r.json()
      return { answer: Math.round(d.ethereum?.usd ?? 0) }
    },
  },
  // === GENERAL CRYPTO (22–29) ===
  {
    type: 'crypto-mcap-billions',
    hint: 'Check CoinGecko global stats — total market cap in billions. Usually $1T–$4T.',
    baseQuestion: 'What is the total crypto market cap in billions of USD? (e.g. enter 3200 for $3.2T)',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/global')
      const d = await r.json()
      return { answer: Math.round((d.data?.total_market_cap?.usd ?? 0) / 1e9) }
    },
  },
  {
    type: 'btc-dominance',
    hint: 'BTC\'s % of total crypto market cap. Usually 40–65%. Check CoinGecko global.',
    baseQuestion: 'What is Bitcoin\'s current market dominance percentage? (enter 59 for 59%)',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/global')
      const d = await r.json()
      return { answer: Math.round(d.data?.market_cap_percentage?.btc ?? 0) }
    },
  },
  {
    type: 'fear-greed',
    hint: 'Check alternative.me/crypto/fear-and-greed-index/ — 0=Extreme Fear, 100=Extreme Greed.',
    baseQuestion: 'What is today\'s Crypto Fear & Greed Index? (0=extreme fear, 100=extreme greed)',
    async getAnswer() {
      const r = await fetch('https://api.alternative.me/fng/?limit=1')
      const d = await r.json()
      return { answer: Math.max(0, parseInt(d.data?.[0]?.value ?? '50', 10)) }
    },
  },
  {
    type: 'eth-dominance',
    hint: 'ETH\'s % of total crypto market cap. Usually 10–20%. Check CoinGecko global.',
    baseQuestion: 'What is Ethereum\'s current market dominance percentage? (enter 13 for 13%)',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/global')
      const d = await r.json()
      return { answer: Math.round(d.data?.market_cap_percentage?.eth ?? 0) }
    },
  },
  {
    type: 'coingecko-coins-thousands',
    hint: 'CoinGecko tracks over 10,000 coins. Enter the count in thousands (e.g. enter 15 for ~15,000).',
    baseQuestion: 'How many cryptocurrencies does CoinGecko track? (answer in thousands)',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/global')
      const d = await r.json()
      return { answer: Math.round((d.data?.active_cryptocurrencies ?? 0) / 1000) }
    },
  },
  {
    type: 'sol-price',
    hint: 'Check any major exchange. SOL has been between $50 and $300 in 2024-2025.',
    baseQuestion: 'What is the current Solana (SOL) price in whole USD?',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd')
      const d = await r.json()
      return { answer: Math.round(d.solana?.usd ?? 0) }
    },
  },
  {
    type: 'usdt-mcap-billions',
    hint: 'USDT is the largest stablecoin — market cap in hundreds of billions. Check CoinGecko.',
    baseQuestion: 'What is the USDT (Tether) market cap in billions of USD? (enter 140 for $140B)',
    async getAnswer() {
      const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=usd&include_market_cap=true')
      const d = await r.json()
      return { answer: Math.round((d.tether?.usd_market_cap ?? 0) / 1e9) }
    },
  },
  {
    type: 'defi-tvl-billions',
    hint: 'Total DeFi TVL across all chains. Check defillama.com — usually $50B–$200B.',
    baseQuestion: 'What is the total DeFi TVL (Total Value Locked) in billions of USD? (enter 95 for $95B)',
    async getAnswer() {
      const r = await fetch('https://api.llama.fi/v2/chains')
      const chains: Array<{ tvl?: number }> = await r.json()
      const total = chains.reduce((s, c) => s + (c.tvl ?? 0), 0)
      return { answer: Math.round(total / 1e9) }
    },
  },
]

export function useQuest() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [txId,    setTxId]    = useState<string | null>(null)

  const readOnly = async (fn: string, args: any[], sender: string) => {
    try {
      const res = await fetch(
        `${API}/v2/contracts/call-read/${CONTRACT_ADDRESS}/${CONTRACT_NAME}/${fn}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender, arguments: args }),
        }
      )
      const data = await res.json()
      return data?.result
    } catch { return null }
  }

  const getTodayPuzzle = async () => {
    const dayIndex = Math.floor(Date.now() / 86400000) % PUZZLE_BANK.length
    const template = PUZZLE_BANK[dayIndex]
    let question = template.baseQuestion
    let answer: number | undefined

    try {
      const result = await template.getAnswer()
      if (result) {
        if (result.answer > 0) answer = result.answer
        if (result.question) question = result.question
      }
    } catch {}

    return { type: template.type, question, hint: template.hint, answer }
  }

  const getPlayerStats = async (addr: string) => {
    try {
      const s = typeof window !== 'undefined' ? localStorage.getItem(`sq_streak_${addr}`) : null
      if (s) {
        const d = JSON.parse(s)
        return { streak: d.current_streak || 0, total: d.total_checkins || 0, wins: 0 }
      }
    } catch {}
    return { streak: 0, total: 0, wins: 0 }
  }

  const hasPlayedToday = async (addr: string): Promise<boolean> => {
    try {
      const todayKey = new Date().toISOString().slice(0, 10)
      const s = typeof window !== 'undefined' ? localStorage.getItem(`sq_played_${addr}_${todayKey}`) : null
      if (s) return true
    } catch {}
    try {
      const result = await readOnly('has-played-today', [principalToHex(addr)], addr)
      return result === '0x03'
    } catch { return false }
  }

  return { getTodayPuzzle, getPlayerStats, hasPlayedToday, loading, error, txId }
}

// Serialize a principal as a hex-encoded Clarity CV for the Hiro read-only API
function principalToHex(addr: string): string {
  try {
    const hex = serializeCV(principalCV(addr))
    // serializeCV returns a hex string without 0x prefix in @stacks/transactions v7
    return (hex as unknown as string).startsWith('0x') ? (hex as unknown as string) : `0x${hex}`
  } catch {
    return addr
  }
}
