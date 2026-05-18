'use client'

import { useState } from 'react'
import { openContractCall } from '@stacks/connect'
import { fetchCallReadOnlyFunction, cvToValue, uintCV, PostConditionMode, AnchorMode } from '@stacks/transactions'
import { network, APP_DETAILS } from './useWallet'

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const CONTRACT_NAME    = process.env.NEXT_PUBLIC_CONTRACT_NAME    || 'stacks-quest'

export function useQuest() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [txId,    setTxId]    = useState<string | null>(null)

  // Get today's puzzle from contract
  const getTodayPuzzle = async () => {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName:    CONTRACT_NAME,
        functionName:    'get-today-puzzle',
        functionArgs:    [],
        network,
        senderAddress:   CONTRACT_ADDRESS,
      })
      return cvToValue(result)
    } catch (e) {
      console.error('getTodayPuzzle:', e)
      return null
    }
  }

  // Get player stats
  const getPlayerStats = async (address: string) => {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName:    CONTRACT_NAME,
        functionName:    'get-player-stats',
        functionArgs:    [],
        network,
        senderAddress:   address,
      })
      return cvToValue(result)
    } catch (e) {
      console.error('getPlayerStats:', e)
      return null
    }
  }

  // Check if player already played today
  const hasPlayedToday = async (address: string) => {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: CONTRACT_ADDRESS,
        contractName:    CONTRACT_NAME,
        functionName:    'has-played-today',
        functionArgs:    [],
        network,
        senderAddress:   address,
      })
      return cvToValue(result)
    } catch (e) {
      return false
    }
  }

  // Submit guess + bet on-chain
  const play = async (guess: number, betAmount: number) => {
    setLoading(true)
    setError(null)
    setTxId(null)
    try {
      await openContractCall({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName:    CONTRACT_NAME,
        functionName:    'play',
        functionArgs:    [
          uintCV(guess),
          uintCV(Math.floor(betAmount * 1_000_000)), // convert to micro-B2S
        ],
        postConditionMode: PostConditionMode.Allow,
        anchorMode:        AnchorMode.Any,
        appDetails:        APP_DETAILS,
        onFinish: (data) => {
          setTxId(data.txId)
          setLoading(false)
        },
        onCancel: () => {
          setError('Cancelled')
          setLoading(false)
        },
      })
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
      setLoading(false)
    }
  }

  // Claim reward after winning
  const claimReward = async (dayId: number) => {
    setLoading(true)
    setError(null)
    try {
      await openContractCall({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName:    CONTRACT_NAME,
        functionName:    'claim-reward',
        functionArgs:    [uintCV(dayId)],
        postConditionMode: PostConditionMode.Allow,
        anchorMode:        AnchorMode.Any,
        appDetails:        APP_DETAILS,
        onFinish: (data) => {
          setTxId(data.txId)
          setLoading(false)
        },
        onCancel: () => {
          setError('Cancelled')
          setLoading(false)
        },
      })
    } catch (e: any) {
      setError(e.message || 'Failed to claim')
      setLoading(false)
    }
  }

  return { play, claimReward, getTodayPuzzle, getPlayerStats, hasPlayedToday, loading, error, txId }
}