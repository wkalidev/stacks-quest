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

  // Appel read-only via API Hiro — pas besoin de @stacks/transactions
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

  const getTodayPuzzle = (addr = CONTRACT_ADDRESS) =>
    readOnly('get-today-puzzle', [], addr)

  const getPlayerStats = (addr: string) =>
    readOnly('get-player-stats', [principalToHex(addr)], addr)

  const hasPlayedToday = (addr: string) =>
    readOnly('has-played-today', [principalToHex(addr)], addr)

  return { getTodayPuzzle, getPlayerStats, hasPlayedToday, loading, error, txId }
}

// Serialize a principal as a hex-encoded Clarity CV for the Hiro read-only API
function principalToHex(addr: string): string {
  try {
    const hex = serializeCV(principalCV(addr))
    // serializeCV returns a hex string without 0x prefix in @stacks/transactions v7
    return hex.startsWith('0x') ? hex : `0x${hex}`
  } catch {
    return addr
  }
}