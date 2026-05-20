'use client'

import { useState, useEffect } from 'react'
import { openContractCall } from '@stacks/connect'
import { uintCV }           from '@stacks/transactions'
import { STACKS_MAINNET }   from '@stacks/network'

const CONTRACT_ADDRESS = 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const CONTRACT_NAME    = 'stacks-quest-v2'

type WalletState = {
  mounted:     boolean
  isConnected: boolean
  address:     string | null
  connect:     () => Promise<void>
  disconnect:  () => void
  submitGuess: (
    guess:     number,
    betAmount: number,
    token:     number,
    onFinish:  (txid: string) => void,
    onCancel:  () => void,
  ) => Promise<void>
}

export function useWallet(): WalletState {
  const [mounted,     setMounted]     = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [address,     setAddress]     = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('sq_address')
      if (saved) { setIsConnected(true); setAddress(saved) }
    } catch {}
  }, [])

  const connect = async () => {
    const provider =
      (window as any).LeatherProvider ||
      (window as any).StacksProvider

    if (!provider) {
      window.open('https://leather.io/install-extension', '_blank')
      return
    }

    try {
      let addr: string | null = null

      if ((window as any).LeatherProvider) {
        const res = await (window as any).LeatherProvider.request('getAddresses')
        addr = res?.result?.addresses?.find((a: any) => a.symbol === 'STX')?.address
      }

      if (!addr) {
        const res = await provider.request('getAddresses', null)
        addr =
          res?.result?.addresses?.find((a: any) => a.symbol === 'STX')?.address ||
          res?.addresses?.find((a: any) => a.symbol === 'STX')?.address
      }

      if (addr) {
        setAddress(addr)
        setIsConnected(true)
        localStorage.setItem('sq_address', addr)
      }
    } catch (e: any) {
      console.error('[useWallet] connect error:', e?.message || e)
    }
  }

  const disconnect = () => {
    setAddress(null)
    setIsConnected(false)
    try { localStorage.removeItem('sq_address') } catch {}
  }

  // token: 0=STX 1=B2S 2=USDCx 3=sBTC
  // betAmount: en tokens entiers (ex: 5 B2S) — converti en micro ici
  const submitGuess = async (
    guess:    number,
    betAmount: number,
    token:    number,
    onFinish: (txid: string) => void,
    onCancel: () => void,
  ) => {
    const microBet = betAmount * 1_000_000 // 6 decimales

    await openContractCall({
      network:          STACKS_MAINNET,
      contractAddress:  CONTRACT_ADDRESS,
      contractName:     CONTRACT_NAME,
      functionName:     'play',
      functionArgs: [
        uintCV(guess),
        uintCV(microBet),
        uintCV(token),
      ],
      postConditionMode: 0x01,
      onFinish: (data) => {
        console.log('[submitGuess] txid:', data.txId)
        onFinish(data.txId)
      },
      onCancel: () => {
        console.log('[submitGuess] cancelled')
        onCancel()
      },
    })
  }

  return { mounted, isConnected, address, connect, disconnect, submitGuess }
}