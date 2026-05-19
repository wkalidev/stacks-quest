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
const APP_DETAILS = { name: 'Stacks Quest', icon: 'https://stacks-quest-ten.vercel.app/logo.svg' }

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const CONTRACT_NAME    = process.env.NEXT_PUBLIC_CONTRACT_NAME    || 'stacks-quest'

const toHex = (cv: any): string => {
  const bytes = serializeCV(cv)
  return Buffer.from(bytes).toString('hex')
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

  // Ouvre Leather pour signer la transaction play
  const play = async (guess: number, betAmount: number, playerAddress: string) => {
    setLoading(true); setError(null); setTxId(null)
    const microBet = Math.floor(betAmount * 1_000_000)
    try {
      const { request } = await import('@stacks/connect')
      const response = await (request as any)('stx_callContract', {
        contract:     `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
        functionName: 'play',
        functionArgs: [
          toHex(uintCV(guess)),
          toHex(uintCV(microBet)),
        ],
        network:    'mainnet',
        appDetails: APP_DETAILS,
      })
      const txid = response?.result?.txid || response?.txid
      if (txid) setTxId(txid)
    } catch (e: any) {
      setError(e?.message || 'Transaction cancelled')
    } finally { setLoading(false) }
  }

  // Ouvre Leather pour claim-reward
  const claimReward = async (dayId: number) => {
    setLoading(true); setError(null)
    try {
      const { request } = await import('@stacks/connect')
      const response = await (request as any)('stx_callContract', {
        contract:     `${CONTRACT_ADDRESS}.${CONTRACT_NAME}`,
        functionName: 'claim-reward',
        functionArgs: [
          toHex(uintCV(dayId)),
        ],
        network:    'mainnet',
        appDetails: APP_DETAILS,
      })
      const txid = response?.result?.txid || response?.txid
      if (txid) setTxId(txid)
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
