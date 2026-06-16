'use client'

import { useState } from 'react'
import { principalCV, serializeCV } from '@stacks/transactions'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const CONTRACT_NAME    = process.env.NEXT_PUBLIC_CONTRACT_NAME    || 'stacks-quest-v2'
const API              = 'https://api.mainnet.hiro.so'

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
    try {
      const res = await fetch(`${API}/v2/info`)
      const info = await res.json()
      const height: number = info.stacks_tip_height
      const puzzleTypes = [
        {
          type: 'block-height',
          question: `What is the current Stacks block height? (hint: it's around ${Math.floor(height / 1000) * 1000})`,
          answer: height,
        },
        {
          type: 'stx-price',
          question: 'What is the current STX price in USD cents? (e.g. enter 25 for $0.25)',
          answer: null,
        },
      ]
      const today = new Date().getDate() % puzzleTypes.length
      return puzzleTypes[today]
    } catch {
      return { type: 'block-height', question: 'What is the current Stacks block height?', answer: null }
    }
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
