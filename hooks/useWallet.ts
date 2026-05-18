'use client'

import { useState, useEffect } from 'react'

type WalletState = {
  mounted: boolean
  isConnected: boolean
  address: string | null
  connect: () => Promise<void>
  disconnect: () => void
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
    // Try Leather first (LeatherProvider), then StacksProvider
    const provider =
      (window as any).LeatherProvider ||
      (window as any).StacksProvider

    if (!provider) {
      window.open('https://leather.io/install-extension', '_blank')
      return
    }

    try {
      let addr: string | null = null

      // Leather new API
      if ((window as any).LeatherProvider) {
        const res = await (window as any).LeatherProvider.request('getAddresses')
        addr = res?.result?.addresses?.find((a: any) => a.symbol === 'STX')?.address
      }

      // Fallback: StacksProvider
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

  return { mounted, isConnected, address, connect, disconnect }
}