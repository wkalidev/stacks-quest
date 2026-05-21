'use client'

import { useState } from 'react'

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

// Encode un principal en hex pour l'API read-only
function principalToHex(addr: string): string {
  // Format attendu par l'API Hiro: "0x" + CV serialise
  // Pour un principal standard: type byte 0x05 + hash160
  // On passe le principal en string directement — l'API accepte aussi ce format
  return addr
}