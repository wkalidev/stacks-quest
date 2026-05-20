'use client'

import { useState } from 'react'
import { openContractCall } from '@stacks/connect'
import {
  fetchCallReadOnlyFunction,
  cvToValue,
  uintCV,
  PostConditionMode,
  AnchorMode,
  Pc,
} from '@stacks/transactions'
import { STACKS_MAINNET } from '@stacks/network'

const network     = STACKS_MAINNET
const APP_DETAILS = { name: 'Stacks Quest', icon: 'https://stacks-quest.vercel.app/logo.svg' }

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const CONTRACT_NAME    = process.env.NEXT_PUBLIC_CONTRACT_NAME_V2 || 'stacks-quest-v2'

// Token identifiers — must match contract constants
export const TOKEN_STX   = 0
export const TOKEN_B2S   = 1
export const TOKEN_USDCX = 2
export const TOKEN_SBTC  = 3

export type TokenId = 0 | 1 | 2 | 3

export const TOKEN_INFO = {
  [TOKEN_STX]: {
    name: 'Stacks',
    symbol: 'STX',
    decimals: 6,
    contractAddress: null,
    contractName: null,
    assetName: null,
  },
  [TOKEN_B2S]: {
    name: 'Base2Stacks',
    symbol: 'B2S',
    decimals: 6,
    contractAddress: 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N',
    contractName: 'b2s-token-v4',
    assetName: 'b2s-token',
  },
  [TOKEN_USDCX]: {
    name: 'USD Coin',
    symbol: 'USDCx',
    decimals: 6,
    contractAddress: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE',
    contractName: 'usdcx',
    assetName: 'usdcx',
  },
  [TOKEN_SBTC]: {
    name: 'Stacks Bitcoin',
    symbol: 'sBTC',
    decimals: 8,
    contractAddress: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4',
    contractName: 'sbtc-token',
    assetName: 'sbtc',
  },
} as const

// Build post-conditions using the new Pc builder API
// The wallet will show exactly what will be debited — no surprises
function buildPostConditions(address: string, amount: number, token: TokenId) {
  const pc = Pc.principal(address).willSendEq(amount)

  if (token === TOKEN_STX) {
    return [pc.ustx()]
  }

  const info = TOKEN_INFO[token]
  if (!info.contractAddress || !info.contractName || !info.assetName) return []

  return [
    pc.ft(`${info.contractAddress}.${info.contractName}`, info.assetName)
  ]
}

export function useQuestV2() {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [txId,    setTxId]    = useState<string | null>(null)

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

  // Play — opens Leather wallet for confirmation
  // amount is in human units (e.g. 1.5 STX), converted to micro internally
  const play = async (
    address: string,
    guess: number,
    amount: number,
    token: TokenId
  ) => {
    setLoading(true)
    setError(null)
    setTxId(null)

    const info        = TOKEN_INFO[token]
    const microAmount = Math.floor(amount * Math.pow(10, info.decimals))

    try {
      await openContractCall({
        network,
        contractAddress: CONTRACT_ADDRESS,
        contractName:    CONTRACT_NAME,
        functionName:    'play',
        functionArgs: [
          uintCV(guess),
          uintCV(microAmount),
          uintCV(token),
        ],
        // Strict post-conditions: wallet shows exactly what leaves the user's wallet
        postConditions:    buildPostConditions(address, microAmount, token),
        postConditionMode: PostConditionMode.Deny,
        anchorMode:        AnchorMode.Any,
        appDetails:        APP_DETAILS,
        onFinish: (data) => {
          setTxId(data.txId)
          setLoading(false)
        },
        onCancel: () => {
          setError('Transaction cancelled')
          setLoading(false)
        },
      })
    } catch (e: any) {
      setError(e.message || 'Transaction failed')
      setLoading(false)
    }
  }

  // Claim reward — opens wallet for confirmation
  const claimReward = async (dayId: number) => {
    setLoading(true)
    setError(null)

    try {
      await openContractCall({
        network,
        contractAddress:   CONTRACT_ADDRESS,
        contractName:      CONTRACT_NAME,
        functionName:      'claim-reward',
        functionArgs:      [uintCV(dayId)],
        postConditionMode: PostConditionMode.Allow,
        anchorMode:        AnchorMode.Any,
        appDetails:        APP_DETAILS,
        onFinish: (data) => {
          setTxId(data.txId)
          setLoading(false)
        },
        onCancel: () => {
          setError('Transaction cancelled')
          setLoading(false)
        },
      })
    } catch (e: any) {
      setError(e.message || 'Failed to claim')
      setLoading(false)
    }
  }

  return {
    play,
    claimReward,
    getTodayPuzzle,
    getPlayerStats,
    hasPlayedToday,
    loading,
    error,
    txId,
    TOKEN_INFO,
    TOKEN_STX,
    TOKEN_B2S,
    TOKEN_USDCX,
    TOKEN_SBTC,
  }
}