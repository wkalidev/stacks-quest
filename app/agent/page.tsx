'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWallet } from '../../hooks/useWallet'

const MONO = { fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace" }
const CONTRACT = 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const AGENT_CONTRACT = `${CONTRACT}.stacks-quest-agent-v3`

type Message = { role: 'user' | 'assistant'; content: string; action?: any }
type StreakData = { current_streak: number; best_streak: number; total_checkins: number; pending_reward: number }

const DEX_URLS: Record<string, string> = {
  velar: 'https://app.velar.co',
  alex:  'https://app.alexlab.co/swap',
}

const BRIDGE_URL = 'https://base2stacks-tracker.vercel.app'

function ActionCard({ action, address }: { action: any; address: string | null }) {
  if (!action || !action.type) return null

  if (action.type === 'swap') {
    const url = `${DEX_URLS[action.dex] || DEX_URLS.velar}?from=${action.tokenIn}&to=${action.tokenOut}&amount=${action.amount}`
    return (
      <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 10,
        background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.2)' }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', marginBottom: 8 }}>
          SWAP_ACTION // {action.dex?.toUpperCase()}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#00ff9f' }}>{action.amount} {action.tokenIn}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#00d4ff' }}>{action.tokenOut}</span>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 8, fontSize: 10,
            fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'inherit', cursor: 'pointer',
            background: '#00ff9f', color: 'black', textDecoration: 'none' }}>
          ▶ OPEN_{action.dex?.toUpperCase()} ↗
        </a>
      </div>
    )
  }

  if (action.type === 'bridge') {
    return (
      <div style={{ marginTop: 8, padding: '12px 14px', borderRadius: 10,
        background: 'rgba(255,165,0,0.05)', border: '1px solid rgba(255,165,0,0.2)' }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', marginBottom: 8 }}>
          BRIDGE_ACTION
        </div>
        <div style={{ fontSize: 13, color: '#ffaa00', marginBottom: 10 }}>
          {action.amount} {action.token} · {action.fromChain?.toUpperCase()} → {action.toChain?.toUpperCase()}
        </div>
        <a href={BRIDGE_URL} target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-block', padding: '8px 16px', borderRadius: 8, fontSize: 10,
            fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'inherit',
            background: '#ffaa00', color: 'black', textDecoration: 'none' }}>
          ▶ OPEN_BRIDGE ↗
        </a>
      </div>
    )
  }

  if (action.type === 'checkin') {
    return (
      <div style={{ marginTop: 8, padding: '10px 14px', borderRadius: 10,
        background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)' }}>
        <div style={{ fontSize: 9, color: '#ffd700', letterSpacing: '0.2em' }}>
          💰 0.001 STX FEE · BUILDS STREAK · EARNS REWARDS
        </div>
      </div>
    )
  }

  return null
}

export default function AgentPage() {
  const { mounted, isConnected, address, connect, disconnect } = useWallet()

  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [streak,    setStreak]    = useState<StreakData | null>(null)
  const [checkedIn, setCheckedIn] = useState(false)
  const [checking,  setChecking]  = useState(false)
  const [portfolio, setPortfolio] = useState<Record<string, number>>({})
  const [tab,       setTab]       = useState<'chat' | 'portfolio' | 'streak'>('chat')
  const bottomRef = useRef<HTMLDivElement>(null)

  const short = (a: string) => `${a.slice(0,6)}...${a.slice(-4)}`

  // Fetch streak data
  const fetchStreak = useCallback(async () => {
    if (!address) return
    try {
      const res = await fetch(
        `/api/hiro?path=${encodeURIComponent(`/v2/contracts/call-read/${CONTRACT}/stacks-quest-agent-v3/get-streak`)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sender: address, arguments: [`0x${bufferCVToHex(address)}`] }),
        }
      )
      // Simplified: fetch via read-only
      const statsRes = await fetch(
        `/api/hiro?path=${encodeURIComponent(`/extended/v1/address/${AGENT_CONTRACT}/transactions?limit=1`)}`,
      )
      const today = Math.floor(Date.now() / (144 * 10 * 60 * 1000))
      const saved = localStorage.getItem(`sq_streak_${address}`)
      if (saved) {
        const data = JSON.parse(saved)
        setStreak(data)
        setCheckedIn(data.last_checkin_day === today)
      }
    } catch {}
  }, [address])

  // Fetch portfolio balances
  const fetchPortfolio = useCallback(async () => {
    if (!address) return
    try {
      const res  = await fetch(`/api/hiro?path=${encodeURIComponent(`/extended/v1/address/${address}/balances`)}`)
      const data = await res.json()
      const stx  = Number(data.stx?.balance || 0) / 1_000_000
      const portfolio: Record<string, number> = { STX: stx }

      // Fetch FT balances
      const fts = data.fungible_tokens || {}
      for (const [key, val] of Object.entries(fts) as any[]) {
        if (key.includes('b2s-token'))  portfolio['$B2S']  = Number(val.balance) / 1_000_000
        if (key.includes('usdcx'))      portfolio['USDCx'] = Number(val.balance) / 1_000_000
        if (key.includes('sbtc-token')) portfolio['sBTC']  = Number(val.balance) / 100_000_000
        if (key.includes('token-alex')) portfolio['ALEX']  = Number(val.balance) / 100_000_000
        if (key.includes('welshcorgi')) portfolio['WELSH'] = Number(val.balance) / 1_000_000
      }
      setPortfolio(portfolio)
    } catch {}
  }, [address])

  useEffect(() => {
    if (isConnected && address) {
      fetchStreak()
      fetchPortfolio()
    }
  }, [isConnected, address, fetchStreak, fetchPortfolio])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Helper: encode principal for Clarity call
  function bufferCVToHex(addr: string): string {
    const bytes = new TextEncoder().encode(addr)
    return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('')
  }

  // Daily check-in via wallet
  const handleCheckin = async () => {
    if (!isConnected || checkedIn || checking) return
    setChecking(true)
    try {
      const leather = (window as any).LeatherProvider
      const xverse  = (window as any).XverseProviders?.StacksProvider || (window as any).StacksProvider

      const { uintCV, serializeCV } = await import('@stacks/transactions')
      const toHex = (cv: Uint8Array) => Array.from(cv).map(b => b.toString(16).padStart(2,'0')).join('')

      const params = {
        contract:          AGENT_CONTRACT,
        functionName:      'daily-checkin',
        functionArgs:      [] as any[],
        postConditionMode: 'allow',
        network:           'mainnet',
      }

      let txid: string | null = null

      if (leather) {
        const res = await leather.request('stx_callContract', params)
        txid = res?.result?.txid || res?.result?.transaction_id
      } else if (xverse) {
        const res = await xverse.request('stx_callContract', {
          contractAddress: CONTRACT,
          contractName:    'stacks-quest-agent-v3',
          ...params,
        })
        txid = res?.result?.txid || res?.result?.transaction_id
      }

      if (txid) {
        // Save streak to localStorage optimistically
        const today = Math.floor(Date.now() / (144 * 10 * 60 * 1000))
        const prev  = streak || { current_streak: 0, best_streak: 0, total_checkins: 0, pending_reward: 0 }
        const newStreak = {
          ...prev,
          current_streak: prev.current_streak + 1,
          best_streak:    Math.max(prev.best_streak, prev.current_streak + 1),
          total_checkins: prev.total_checkins + 1,
          last_checkin_day: today,
        }
        localStorage.setItem(`sq_streak_${address}`, JSON.stringify(newStreak))
        setStreak(newStreak as any)
        setCheckedIn(true)
        setMessages(m => [...m, {
          role: 'assistant',
          content: `✅ Check-in confirmed! Streak: ${newStreak.current_streak} days 🔥\n\nTX: ${txid}\n\n${newStreak.current_streak % 7 === 0 ? '🎉 7-day streak bonus earned!' : `${7 - (newStreak.current_streak % 7)} days until streak bonus`}`,
        }])
      }
    } catch (e: any) {
      setMessages(m => [...m, { role: 'assistant', content: `⚠ Check-in failed: ${e?.message || 'Wallet cancelled'}` }])
    } finally {
      setChecking(false)
    }
  }

  // Send message to Groq agent
  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMsg: Message = { role: 'user', content: input.trim() }
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res  = await fetch('/api/agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
          address,
        }),
      })
      const data = await res.json()
      setMessages(m => [...m, {
        role:    'assistant',
        content: data.action?.message || data.content,
        action:  data.action,
      }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: '⚠ Agent unavailable. Try again.' }])
    } finally {
      setLoading(false)
    }
  }

  if (!mounted) return null

  const NEON_COLORS: Record<string, string> = {
    STX: '#9945ff', '$B2S': '#00ff9f', sBTC: '#f7931a',
    USDCx: '#2775ca', ALEX: '#00d4ff', WELSH: '#ff6b9d',
  }

  return (
    <div className="min-h-screen bg-black flex flex-col" style={MONO}>

      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 20px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,255,159,0.1)',
              border: '1px solid rgba(0,255,159,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18 }}>🤖</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>
                STACKS<span style={{ opacity: 0.3 }}>_</span>AGENT
              </div>
              <div style={{ fontSize: 9, color: 'rgba(0,255,159,0.6)', letterSpacing: '0.3em' }}>NON-CUSTODIAL // MAINNET</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Daily check-in button */}
            {isConnected && (
              <button onClick={handleCheckin} disabled={checkedIn || checking}
                style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', padding: '7px 12px',
                  borderRadius: 8, cursor: checkedIn ? 'default' : 'pointer', fontFamily: 'inherit',
                  background: checkedIn ? 'rgba(0,255,159,0.08)' : 'rgba(0,255,159,0.15)',
                  border: checkedIn ? '1px solid rgba(0,255,159,0.2)' : '1px solid rgba(0,255,159,0.5)',
                  color: checkedIn ? 'rgba(0,255,159,0.4)' : '#00ff9f',
                }}>
                {checking ? '...' : checkedIn ? '✓ CHECKED_IN' : `▶ CHECK_IN · 0.001 STX`}
              </button>
            )}
            {streak && streak.current_streak > 0 && (
              <span style={{ fontSize: 10, color: '#ffd700', letterSpacing: '0.1em' }}>
                🔥 {streak.current_streak}d
              </span>
            )}
            <button onClick={isConnected ? disconnect : connect}
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', padding: '8px 14px',
                borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                background: isConnected ? 'rgba(255,68,68,0.08)' : 'rgba(255,255,255,0.06)',
                border:     isConnected ? '1px solid rgba(255,68,68,0.25)' : '1px solid rgba(255,255,255,0.12)',
                color:      isConnected ? '#ff6666' : 'rgba(255,255,255,0.55)',
              }}>
              {isConnected ? `◼ ${short(address!)}` : '▶ CONNECT'}
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex' }}>
        {(['chat', 'portfolio', 'streak'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '10px 20px', fontSize: 9, letterSpacing: '0.25em', fontFamily: 'inherit',
              cursor: 'pointer', background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid #00ff9f' : '2px solid transparent',
              color: tab === t ? '#00ff9f' : 'rgba(255,255,255,0.3)',
              fontWeight: tab === t ? 700 : 400,
            }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {/* CHAT TAB */}
      {tab === 'chat' && (
        <div className="flex-1 flex flex-col" style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '0 16px' }}>

          {/* Welcome message */}
          {messages.length === 0 && (
            <div style={{ padding: '32px 0 16px' }}>
              <div style={{ padding: '20px', borderRadius: 12, background: 'rgba(0,255,159,0.03)',
                border: '1px solid rgba(0,255,159,0.1)' }}>
                <p style={{ fontSize: 11, color: '#00ff9f', letterSpacing: '0.2em', marginBottom: 8 }}>
                  🤖 STACKS_AGENT READY
                </p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 16 }}>
                  Your non-custodial crypto assistant on Stacks. I can help you swap tokens, bridge assets, check your portfolio, and manage your daily streak.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {[
                    'Swap 10 STX for $B2S',
                    'What is my portfolio?',
                    'Bridge 50 USDC from Base to Stacks',
                    'Buy some sBTC',
                    'How do streaks work?',
                    'What tokens do you support?',
                  ].map(s => (
                    <button key={s} onClick={() => setInput(s)}
                      style={{ fontSize: 9, padding: '5px 10px', borderRadius: 6, letterSpacing: '0.1em',
                        fontFamily: 'inherit', cursor: 'pointer',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.4)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1" style={{ paddingBottom: 100 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                marginBottom: 16,
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '80%', padding: '12px 16px', borderRadius: 12,
                  background: msg.role === 'user'
                    ? 'rgba(255,255,255,0.07)'
                    : 'rgba(0,255,159,0.04)',
                  border: msg.role === 'user'
                    ? '1px solid rgba(255,255,255,0.1)'
                    : '1px solid rgba(0,255,159,0.12)',
                }}>
                  {msg.role === 'assistant' && (
                    <p style={{ fontSize: 8, color: 'rgba(0,255,159,0.5)', letterSpacing: '0.2em', marginBottom: 6 }}>
                      AGENT
                    </p>
                  )}
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </p>
                  {msg.action && <ActionCard action={msg.action} address={address} />}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
                <div style={{ padding: '12px 16px', borderRadius: 12,
                  background: 'rgba(0,255,159,0.04)', border: '1px solid rgba(0,255,159,0.12)' }}>
                  <p style={{ fontSize: 8, color: 'rgba(0,255,159,0.5)', letterSpacing: '0.2em', marginBottom: 4 }}>AGENT</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Thinking<span style={{ animation: 'pulse 1s infinite' }}>...</span></p>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            padding: '12px 16px', background: 'rgba(0,0,0,0.95)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 8 }}>
              {!isConnected && (
                <button onClick={connect}
                  style={{ padding: '12px 16px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                    letterSpacing: '0.2em', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                    background: 'white', border: 'none', color: 'black' }}>
                  CONNECT
                </button>
              )}
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={isConnected ? "Ask me anything... swap, bridge, portfolio..." : "Connect wallet to start"}
                disabled={loading}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  color: 'white', fontSize: 12, fontFamily: 'inherit', outline: 'none',
                }}
              />
              <button onClick={sendMessage} disabled={!input.trim() || loading}
                style={{
                  padding: '12px 20px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                  letterSpacing: '0.2em', fontFamily: 'inherit', cursor: input.trim() ? 'pointer' : 'not-allowed',
                  background: input.trim() ? '#00ff9f' : 'rgba(255,255,255,0.06)',
                  border: 'none', color: input.trim() ? 'black' : 'rgba(255,255,255,0.2)',
                }}>
                SEND
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PORTFOLIO TAB */}
      {tab === 'portfolio' && (
        <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
          {!isConnected ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <button onClick={connect} style={{ padding: '14px 28px', borderRadius: 10, fontSize: 11,
                fontWeight: 700, letterSpacing: '0.3em', fontFamily: 'inherit', cursor: 'pointer',
                background: 'white', border: 'none', color: 'black' }}>
                CONNECT_WALLET
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.25em' }}>PORTFOLIO // {short(address!)}</span>
                <button onClick={fetchPortfolio} style={{ fontSize: 9, padding: '4px 10px', borderRadius: 6,
                  fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
                  ↻ REFRESH
                </button>
              </div>
              {Object.entries(portfolio).length === 0 ? (
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', padding: 20 }}>Loading balances...</p>
              ) : (
                Object.entries(portfolio).map(([token, bal]) => (
                  <div key={token} style={{
                    padding: '14px 18px', borderRadius: 12, display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between',
                    background: `${NEON_COLORS[token] || '#ffffff'}08`,
                    border: `1px solid ${NEON_COLORS[token] || '#ffffff'}18`,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: NEON_COLORS[token] || '#fff' }} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'white', letterSpacing: '0.1em' }}>{token}</span>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: NEON_COLORS[token] || '#fff' }}>
                      {bal.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </span>
                  </div>
                ))
              )}
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <a href="https://app.velar.co" target="_blank" rel="noopener noreferrer"
                  style={{ padding: '12px', borderRadius: 10, textAlign: 'center', textDecoration: 'none',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)' }}>
                  SWAP ON VELAR ↗
                </a>
                <a href="https://app.alexlab.co/swap" target="_blank" rel="noopener noreferrer"
                  style={{ padding: '12px', borderRadius: 10, textAlign: 'center', textDecoration: 'none',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)' }}>
                  SWAP ON ALEX ↗
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STREAK TAB */}
      {tab === 'streak' && (
        <div style={{ maxWidth: 720, width: '100%', margin: '0 auto', padding: '24px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Check-in card */}
            <div style={{ padding: '24px', borderRadius: 16, textAlign: 'center',
              background: checkedIn ? 'rgba(0,255,159,0.04)' : 'rgba(255,215,0,0.04)',
              border: checkedIn ? '1px solid rgba(0,255,159,0.2)' : '1px solid rgba(255,215,0,0.2)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>{checkedIn ? '✅' : '🔥'}</div>
              <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.2em', marginBottom: 4,
                color: checkedIn ? '#00ff9f' : '#ffd700' }}>
                {checkedIn ? 'CHECKED_IN_TODAY' : 'CHECK_IN_NOW'}
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: 16 }}>
                {checkedIn ? 'Come back tomorrow to keep your streak!' : '0.001 STX · Builds streak · Earns rewards'}
              </p>
              {!checkedIn && isConnected && (
                <button onClick={handleCheckin} disabled={checking}
                  style={{ padding: '12px 28px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.25em', fontFamily: 'inherit', cursor: 'pointer',
                    background: '#ffd700', border: 'none', color: 'black' }}>
                  {checking ? 'CONFIRMING...' : '▶ CHECK_IN · 0.001 STX'}
                </button>
              )}
              {!isConnected && (
                <button onClick={connect} style={{ padding: '12px 28px', borderRadius: 10, fontSize: 11,
                  fontWeight: 700, letterSpacing: '0.25em', fontFamily: 'inherit', cursor: 'pointer',
                  background: 'white', border: 'none', color: 'black' }}>
                  CONNECT_WALLET
                </button>
              )}
            </div>

            {/* Streak stats */}
            {streak && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
                {[
                  { label: 'CURRENT_STREAK', val: `${streak.current_streak}d`, color: '#ffd700' },
                  { label: 'BEST_STREAK',    val: `${streak.best_streak}d`,    color: '#ff00ff' },
                  { label: 'TOTAL_CHECKINS', val: streak.total_checkins,       color: '#00d4ff' },
                  { label: 'PENDING_REWARD', val: `${(streak.pending_reward / 1_000_000).toFixed(4)} STX`, color: '#00ff9f' },
                ].map(s => (
                  <div key={s.label} style={{ padding: '16px', borderRadius: 12,
                    background: `${s.color}06`, border: `1px solid ${s.color}18` }}>
                    <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.2em', marginBottom: 4 }}>{s.label}</p>
                    <p style={{ fontSize: 20, fontWeight: 700, color: s.color, margin: 0 }}>{s.val}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Bonus milestones */}
            <div style={{ padding: '16px', borderRadius: 12,
              background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', marginBottom: 12 }}>
                STREAK_BONUSES
              </p>
              {[
                { days: 7,  bonus: '0.002 STX', icon: '🥈' },
                { days: 30, bonus: '0.01 STX',  icon: '🥇' },
                { days: 100,bonus: '0.05 STX',  icon: '💎' },
              ].map(b => {
                const current = streak?.current_streak || 0
                const done    = current >= b.days
                return (
                  <div key={b.days} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{b.icon}</span>
                      <span style={{ fontSize: 10, color: done ? 'white' : 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
                        {b.days}-DAY STREAK
                      </span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: done ? '#00ff9f' : 'rgba(255,255,255,0.2)' }}>
                      +{b.bonus}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '12px 20px',
        marginTop: tab !== 'chat' ? 0 : undefined }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.1)', letterSpacing: '0.2em' }}>
            STACKS_AGENT // NON-CUSTODIAL // POWERED BY GROQ
          </span>
          <a href="https://base2stacks-tracker.vercel.app" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.2)', textDecoration: 'none' }}>
            BASE2STACKS ↗
          </a>
        </div>
      </footer>
    </div>
  )
}