'use client'

import { useState } from 'react'
import {
  fetchCallReadOnlyFunction,
  cvToValue,
  uintCV,
  principalCV,
  serializeCV,
} from '@stacks/transactions'
import { STACKS_MAINNET } from '@stacks/network'

const network     = STACKS_MAINNET

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const CONTRACT_NAME    = process.env.NEXT_PUBLIC_CONTRACT_NAME    || 'stacks-quest'

// Convertir un ClarityValue en hex pour Leather
const cvHex = (cv: ReturnType<typeof uintCV>): string => {
  const bytes = serializeCV(cv)
  return '0x' + Array.from(new Uint8Array(bytes as unknown as ArrayBuffer))
    .map(b => b.toString(16).padStart(2, '0')).join('')
}

export function useQuest() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [txId,    setTxId]    = useState<string | null>(null)

  const readOnly = async (fn: string, args: any[], sender: string) => {
    try {
      const r = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName:    CONTRACT_NAME,
        functionName:    fn,
        functionArgs:    args,
        network,
        senderAddress:   sender || CONTRACT_ADDRESS,
      })
      return cvToValue(r)
    } catch { return null }
  }

  const getTodayPuzzle = (addr = CONTRACT_ADDRESS) =>
    readOnly('get-today-puzzle', [], addr)
  const getPlayerStats = (addr: string) =>
    readOnly('get-player-stats', [principalCV(addr)], addr)
  const hasPlayedToday = (addr: string) =>
    readOnly('has-played-today', [principalCV(addr)], addr)
  const getGlobalStats = () =>
    readOnly('get-global-stats', [], CONTRACT_ADDRESS)

  const callContract = async (functionName: string, args: any[]) => {
    const provider = (window as any).LeatherProvider || (window as any).StacksProvider
    if (!provider) throw new Error('Wallet not found — install Leather')

    const response = await provider.request('stx_callContract', {
      contract:     `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
      functionName,
      functionArgs: args.map(cvHex),
      network:      'mainnet',
    })
    return response?.result?.txid || response?.result?.transaction?.txid || null
  }

  const play = async (guess: number, betAmount: number, _addr: string) => {
    setLoading(true); setError(null); setTxId(null)
    try {
      const microBet = Math.floor(betAmount * 1_000_000)
      const id = await callContract('play', [uintCV(guess), uintCV(microBet)])
      if (id) setTxId(id)
    } catch (e: any) {
      setError(e?.message || 'Transaction failed')
    } finally { setLoading(false) }
  }

  const claimReward = async (dayId: number) => {
    setLoading(true); setError(null)
    try {
      const id = await callContract('claim-reward', [uintCV(dayId)])
      if (id) setTxId(id)
    } catch (e: any) {
      setError(e?.message || 'Claim failed')
    } finally { setLoading(false) }
  }

  return {
    play, claimReward,
    getTodayPuzzle, getPlayerStats, hasPlayedToday, getGlobalStats,
    loading, error, txId,
  }
}
