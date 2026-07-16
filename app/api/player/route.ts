// app/api/player/route.ts
// Player stats endpoint consumed by the @wkalidev/stacks-quest-sdk `getPlayerStats()` method.
// (Previously missing entirely — the SDK called this route but it 404'd on every request.)
import { NextRequest, NextResponse } from 'next/server'
import { callReadOnly, cvUint, cvBool, principalToHex } from '../../lib/stacksRead'
import { CHAINS, ChainId } from '../../lib/chains'

const STACKS_CONTRACT = 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const STACKS_AGENT     = 'stacks-quest-agent-v3'

const STACKS_ADDR_RE = /^SP[A-Z0-9]{1,40}$/
const EVM_ADDR_RE    = /^0x[0-9a-fA-F]{40}$/

// ABI selectors for QuestCheckIn.sol (keccak256("getStreak(address)") / ("hasCheckedInToday(address)"))
const SEL_GET_STREAK      = '5eeadb0d'
const SEL_HAS_CHECKED_IN  = '3504f52b'

function toWord(hexAddr: string): string {
  return hexAddr.slice(2).toLowerCase().padStart(64, '0')
}

async function evmCall(rpc: string, to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(rpc, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to, data }, 'latest'], id: 1 }),
    })
    if (!res.ok) return null
    const json = await res.json()
    if (json.error || typeof json.result !== 'string') return null
    return json.result
  } catch {
    return null
  }
}

function word(hexResult: string, index: number): bigint {
  const clean = hexResult.startsWith('0x') ? hexResult.slice(2) : hexResult
  const start = index * 64
  const chunk = clean.slice(start, start + 64) || '0'
  try { return BigInt('0x' + (chunk || '0')) } catch { return 0n }
}

async function getStacksPlayer(address: string) {
  const argHex = principalToHex(address)

  const streak = await callReadOnly(STACKS_CONTRACT, STACKS_AGENT, 'get-streak', [argHex], address)
  const checkedIn = await callReadOnly(STACKS_CONTRACT, STACKS_AGENT, 'has-checked-in-today', [argHex], address)

  const currentStreak = streak ? cvUint(streak, 'current-streak') : 0
  const totalCheckIns = streak ? cvUint(streak, 'total-checkins') : 0
  const lastCheckIn   = streak ? cvUint(streak, 'last-checkin')   : 0
  const canCheckIn    = checkedIn ? !cvBool(checkedIn) : true

  return {
    address,
    streak:        currentStreak,
    totalCheckIns,
    lastCheckIn,
    canCheckIn,
    nextCheckIn:   canCheckIn ? 0 : (lastCheckIn + 1),
  }
}

async function getEvmPlayer(address: string, chain: 'base' | 'celo') {
  const chainCfg = CHAINS[chain]
  const rpc      = chainCfg.rpc
  const contract = chainCfg.contracts.checkIn
  if (!rpc || !contract) return null

  const addrWord = toWord(address)
  const [streakHex, checkedInHex] = await Promise.all([
    evmCall(rpc, contract, `0x${SEL_GET_STREAK}${addrWord}`),
    evmCall(rpc, contract, `0x${SEL_HAS_CHECKED_IN}${addrWord}`),
  ])

  if (!streakHex) return null

  const currentStreak = Number(word(streakHex, 0))
  // bestStreak = word(streakHex, 1) — not part of the SDK's PlayerStats shape
  const lastCheckinDay = Number(word(streakHex, 2))
  const totalCheckins  = Number(word(streakHex, 3))
  const canCheckIn     = checkedInHex ? word(checkedInHex, 0) === 0n : true

  return {
    address,
    streak:        currentStreak,
    totalCheckIns: totalCheckins,
    lastCheckIn:   lastCheckinDay,
    canCheckIn,
    nextCheckIn:   canCheckIn ? 0 : lastCheckinDay + 1,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const address = searchParams.get('address')
  const chain   = (searchParams.get('chain') || 'stacks') as ChainId

  if (!address) {
    return NextResponse.json({ error: 'Missing address param' }, { status: 400 })
  }
  if (!['stacks', 'base', 'celo'].includes(chain)) {
    return NextResponse.json({ error: 'Invalid chain' }, { status: 400 })
  }

  if (chain === 'stacks') {
    if (!STACKS_ADDR_RE.test(address)) {
      return NextResponse.json({ error: 'Invalid Stacks address' }, { status: 400 })
    }
    const stats = await getStacksPlayer(address)
    return NextResponse.json(stats)
  }

  if (!EVM_ADDR_RE.test(address)) {
    return NextResponse.json({ error: 'Invalid EVM address' }, { status: 400 })
  }
  const stats = await getEvmPlayer(address, chain as 'base' | 'celo')
  if (!stats) {
    return NextResponse.json({ error: 'Could not fetch on-chain stats' }, { status: 502 })
  }
  return NextResponse.json(stats)
}
