'use client'
import { useState, useEffect } from 'react'
import { callPlay } from './useContractCall'

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
    try {
      // Try Xverse via showConnect
      const { showConnect } = await import('@stacks/connect')
      showConnect({
        appDetails: { name: 'Stacks Agent', icon: '/favicon.ico' },
        onFinish: (data: any) => {
          const addr = data?.userSession?.loadUserData()?.profile?.stxAddress?.mainnet
            || data?.addresses?.find((a: any) => a.symbol === 'STX' || a.type === 'p2pkh')?.address
            || data?.profile?.stxAddress?.mainnet
          if (addr) {
            setAddress(addr)
            setIsConnected(true)
            localStorage.setItem('sq_address', addr)
          }
        },
        onCancel: () => console.log('Wallet connect cancelled'),
        userSession: undefined as any,
      })
    } catch (e: any) {
      console.error('[useWallet] connect error:', e?.message || e)
    }
  }

  const disconnect = () => {
    setAddress(null)
    setIsConnected(false)
    try { localStorage.removeItem('sq_address') } catch {}
  }

  const submitGuess = async (
    guess:     number,
    betAmount: number,
    token:     number,
    onFinish:  (txid: string) => void,
    onCancel:  () => void,
  ) => {
    await callPlay(guess, betAmount, token, onFinish, onCancel)
  }

  return { mounted, isConnected, address, connect, disconnect, submitGuess }
}
