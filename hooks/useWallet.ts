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
      // @stacks/connect v8+ dropped showConnect() in favor of the SIP-030
      // connect() API: it opens the wallet picker itself and resolves with
      // addresses directly (no onFinish/onCancel callbacks — cancel just
      // rejects the promise, caught below).
      const { connect: connectWallet } = await import('@stacks/connect')
      const result = await connectWallet()
      // `AddressEntry.symbol` is optional and most wallets (incl. Xverse)
      // leave it unset — the README's own example response never sets it.
      // Identify the Stacks address by its c32check format instead
      // (SP.../ST... vs Bitcoin's bc1.../1.../3...).
      const addr = result.addresses.find((a) => /^S[PT][0-9A-Z]+$/.test(a.address))?.address
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
