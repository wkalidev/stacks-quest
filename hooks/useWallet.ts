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
    const leather: any = null
    const xverse  = (window as any).XverseProviders?.StacksProvider ||
                    (window as any).StacksProvider

    if (!xverse) {
      window.open('https://leather.io/install-extension', '_blank')
      return
    }

    try {
      let addr: string | null = null

      if (false) {
        const res = await leather.request('getAddresses')
        addr = res?.result?.addresses?.find((a: any) => a.symbol === 'STX')?.address
      }

      if (!addr && xverse) {
        const res = await xverse.request('getAddresses', null)
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