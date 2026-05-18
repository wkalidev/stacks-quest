'use client'

import { useState, useEffect } from 'react'
import { showConnect, UserSession, AppConfig } from '@stacks/connect'
import { STACKS_MAINNET } from "@stacks/network"

const appConfig  = new AppConfig(['store_write', 'publish_data'])
const userSession = new UserSession({ appConfig })
export const network = STACKS_MAINNET

export const APP_DETAILS = {
  name: 'Stacks Quest',
  icon: 'https://stacks-quest.vercel.app/logo.svg',
}

export function useWallet() {
  const [mounted,     setMounted]     = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [address,     setAddress]     = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    if (userSession.isUserSignedIn()) {
      const data = userSession.loadUserData()
      setIsConnected(true)
      setAddress(data.profile.stxAddress.mainnet)
    }
  }, [])

  const connect = () => {
    showConnect({
      appDetails: APP_DETAILS,
      userSession,
      onFinish: () => {
        const data = userSession.loadUserData()
        setIsConnected(true)
        setAddress(data.profile.stxAddress.mainnet)
      },
      onCancel: () => {},
    })
  }

  const disconnect = () => {
    userSession.signUserOut()
    setIsConnected(false)
    setAddress(null)
  }

  return { mounted, isConnected, address, connect, disconnect, userSession }
}