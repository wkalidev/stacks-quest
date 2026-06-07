'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWallet } from '../../hooks/useWallet'

const CONTRACT      = 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const AGENT_V3      = `${CONTRACT}.stacks-quest-agent-v3`
const DEX: Record<string, string> = {
  velar: 'https://app.velar.co',
  alex:  'https://app.alexlab.co/swap',
}
const BRIDGE_URL = 'https://base2stacks-tracker.vercel.app'
const MONO = { fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace" }

type Msg      = { role: 'user' | 'assistant'; content: string; action?: any }
type Tab      = 'chat' | 'portfolio' | 'streak' | 'withdraw'
type Portfolio = Record<string, number>
type Streak   = { current: number; best: number; total: number }

// ── Neon colours per token ────────────────────────────────────────────────────
const TOKEN_COLOR: Record<string, string> = {
  STX: '#9945ff', '$B2S': '#00ff9f', sBTC: '#f7931a',
  USDCx: '#2775ca', ALEX: '#00d4ff', WELSH: '#ff6b9d',
}

// ── Action card ───────────────────────────────────────────────────────────────
function ActionCard({ action }: { action: any }) {
  if (!action?.type) return null

  if (action.type === 'swap') {
    const url = `${DEX[action.dex] || DEX.velar}?from=${action.tokenIn}&to=${action.tokenOut}&amount=${action.amount}`
    return (
      <div style={{ marginTop: 10, padding: '14px', borderRadius: 12,
        background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.25)' }}>
        <div style={{ fontSize: 9, color: 'rgba(0,255,159,0.5)', letterSpacing: '0.2em', marginBottom: 8 }}>
          SWAP // {action.dex?.toUpperCase()}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#00ff9f' }}>{action.amount} {action.tokenIn}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }}>→</span>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#00d4ff' }}>{action.tokenOut}</span>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '10px 18px', borderRadius: 8, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.15em', background: '#00ff9f', color: 'black',
          textDecoration: 'none', fontFamily: 'inherit',
        }}>▶ OPEN {action.dex?.toUpperCase()} ↗</a>
      </div>
    )
  }

  if (action.type === 'bridge') {
    return (
      <div style={{ marginTop: 10, padding: '14px', borderRadius: 12,
        background: 'rgba(255,165,0,0.05)', border: '1px solid rgba(255,165,0,0.25)' }}>
        <div style={{ fontSize: 9, color: 'rgba(255,165,0,0.6)', letterSpacing: '0.2em', marginBottom: 8 }}>
          BRIDGE // {action.fromChain?.toUpperCase()} → {action.toChain?.toUpperCase()}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#ffaa00', marginBottom: 12 }}>
          {action.amount} {action.token}
        </div>
        <a href={BRIDGE_URL} target="_blank" rel="noopener noreferrer" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '10px 18px', borderRadius: 8, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.15em', background: '#ffaa00', color: 'black',
          textDecoration: 'none', fontFamily: 'inherit',
        }}>▶ OPEN BRIDGE ↗</a>
      </div>
    )
  }

  if (action.type === 'checkin') {
    return (
      <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10,
        background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)',
        fontSize: 10, color: '#ffd700', letterSpacing: '0.15em' }}>
        💰 0.001 STX · Builds streak · Earns rewards — use the STREAK tab
      </div>
    )
  }

  return null
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AgentPage() {
  const { mounted, isConnected, address, connect, disconnect } = useWallet()

  // Chat
  const [msgs,    setMsgs]    = useState<Msg[]>([])
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // UI
  const [tab,     setTab]     = useState<Tab>('chat')

  // Portfolio
  const [port,    setPort]    = useState<Portfolio>({})
  const [portLoading, setPortLoading] = useState(false)

  // Streak
  const [streak,  setStreak]  = useState<Streak>({ current: 0, best: 0, total: 0 })
  const [checkedIn, setCheckedIn] = useState(false)
  const [checking,  setChecking]  = useState(false)

  // Withdraw
  const [withdrawAmt, setWithdrawAmt] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawTx,  setWithdrawTx]  = useState<string | null>(null)
  const [withdrawErr, setWithdrawErr] = useState<string | null>(null)

  const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

  // ── Load streak from localStorage ──────────────────────────────────────────
  useEffect(() => {
    if (!address) return
    try {
      const s = localStorage.getItem(`sq_streak_${address}`)
      if (s) {
        const d = JSON.parse(s)
        setStreak({ current: d.current_streak || 0, best: d.best_streak || 0, total: d.total_checkins || 0 })
        const today = Math.floor(Date.now() / (144 * 10 * 60 * 1000))
        setCheckedIn(d.last_checkin_day === today)
      }
    } catch {}
  }, [address])

  // ── Fetch portfolio ─────────────────────────────────────────────────────────
  const fetchPortfolio = useCallback(async () => {
    if (!address) return
    setPortLoading(true)
    try {
      const res  = await fetch(`/api/hiro?path=${encodeURIComponent(`/extended/v1/address/${address}/balances`)}`)
      const data = await res.json()
      const p: Portfolio = { STX: Number(data.stx?.balance || 0) / 1_000_000 }
      const fts = data.fungible_tokens || {}
      for (const [k, v] of Object.entries(fts) as any[]) {
        if (k.includes('b2s-token'))  p['$B2S']  = Number(v.balance) / 1_000_000
        if (k.includes('usdcx'))      p['USDCx'] = Number(v.balance) / 1_000_000
        if (k.includes('sbtc-token')) p['sBTC']  = Number(v.balance) / 1e8
        if (k.includes('token-alex')) p['ALEX']  = Number(v.balance) / 1e8
        if (k.includes('welshcorgi')) p['WELSH'] = Number(v.balance) / 1_000_000
      }
      setPort(p)
    } catch {}
    setPortLoading(false)
  }, [address])

  useEffect(() => {
    if (isConnected && address) fetchPortfolio()
  }, [isConnected, address, fetchPortfolio])

  // ── Auto-trigger portfolio fetch when agent requests it ──────────────────────
  useEffect(() => {
    const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant' && last.action?.type === 'query' && last.action?.queryType === 'portfolio') {
      setTab('portfolio')
      fetchPortfolio()
    }
  }, [msgs, fetchPortfolio])

  // ── Scroll to bottom ────────────────────────────────────────────────────────
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  // ── Send message ────────────────────────────────────────────────────────────
  const send = async () => {
    if (!input.trim() || loading) return
    const userMsg: Msg = { role: 'user', content: input.trim() }
    setMsgs(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    try {
      const res  = await fetch('/api/agent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: [...msgs, userMsg].map(m => ({ role: m.role, content: m.content })),
          address,
        }),
      })
      const data = await res.json()
      setMsgs(m => [...m, { role: 'assistant', content: data.content || '...', action: data.action }])
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: '⚠ Connection error. Try again.' }])
    }
    setLoading(false)
  }

  // ── Daily check-in ──────────────────────────────────────────────────────────
  const doCheckin = async () => {
    if (!isConnected || checkedIn || checking) return
    setChecking(true)
    try {
      // leather disabled
      const xverse  = (window as any).XverseProviders?.StacksProvider || (window as any).StacksProvider
      const params  = {
        contract: AGENT_V3, functionName: 'daily-checkin',
        functionArgs: [] as any[], postConditionMode: 'allow', network: 'mainnet',
      }
      let txid: string | null = null
      if (false) {
        const r = await leather.request('stx_callContract', params)
        txid = r?.result?.txid || r?.result?.transaction_id
      } else if (xverse) {
        const r = await xverse.request('stx_callContract', { contractAddress: CONTRACT, contractName: 'stacks-quest-agent-v3', ...params })
        txid = r?.result?.txid || r?.result?.transaction_id
      }
      if (txid) {
        const today = Math.floor(Date.now() / (144 * 10 * 60 * 1000))
        const ns    = { current: streak.current + 1, best: Math.max(streak.best, streak.current + 1), total: streak.total + 1 }
        setStreak(ns)
        setCheckedIn(true)
        localStorage.setItem(`sq_streak_${address}`, JSON.stringify({ current_streak: ns.current, best_streak: ns.best, total_checkins: ns.total, last_checkin_day: today }))
        setMsgs(m => [...m, { role: 'assistant', content: `✅ Check-in confirmed! Streak: ${ns.current} days 🔥\n\n${ns.current % 7 === 0 ? '🎉 7-day bonus earned!' : `${7 - (ns.current % 7)} days until next bonus`}\n\nTX: ${txid}` }])
      }
    } catch (e: any) {
      setMsgs(m => [...m, { role: 'assistant', content: `⚠ Check-in failed: ${e?.message || 'Wallet cancelled'}` }])
    }
    setChecking(false)
  }

  // ── Withdraw STX ────────────────────────────────────────────────────────────
  const doWithdraw = async () => {
    if (!isConnected || !withdrawAmt || withdrawing) return
    const amt = parseFloat(withdrawAmt)
    if (isNaN(amt) || amt <= 0) { setWithdrawErr('Invalid amount'); return }
    setWithdrawing(true)
    setWithdrawErr(null)
    setWithdrawTx(null)
    try {
      const { uintCV, serializeTransactionBytes, makeContractCall, AnchorMode } = await import('@stacks/transactions')
      const stacks = await import('@stacks/transactions')
      const micro  = Math.round(amt * 1_000_000)
      const toHex  = (cv: any) => {
        const r = (stacks.serializeCV as any)(cv)
        return Array.from(r as Uint8Array).map((b: number) => b.toString(16).padStart(2,'0')).join('')
      }
      // leather disabled
      const xverse  = (window as any).XverseProviders?.StacksProvider || (window as any).StacksProvider
      const params  = {
        contract: AGENT_V3, functionName: 'withdraw-treasury',
        functionArgs: [toHex(uintCV(micro))],
        postConditionMode: 'allow', network: 'mainnet',
      }
      let txid: string | null = null
      if (false) {
        const r = await leather.request('stx_callContract', params)
        txid = r?.result?.txid || r?.result?.transaction_id
      } else if (xverse) {
        const r = await xverse.request('stx_callContract', { contractAddress: CONTRACT, contractName: 'stacks-quest-agent-v3', ...params })
        txid = r?.result?.txid || r?.result?.transaction_id
      }
      if (txid) { setWithdrawTx(txid); setWithdrawAmt('') }
      else { setWithdrawErr('No txid returned') }
    } catch (e: any) {
      setWithdrawErr(e?.message || 'Wallet cancelled')
    }
    setWithdrawing(false)
  }

  if (!mounted) return null

  const totalPortfolio = Object.values(port).reduce((a, b) => a + b, 0)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ ...MONO, minHeight: '100dvh', background: '#050508', color: '#fff', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', position: 'relative' }}>

      {/* ── Header ── */}
      <header style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50, background: '#050508' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🤖</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '-0.3px' }}>STACKS_AGENT</div>
            <div style={{ fontSize: 8, color: 'rgba(0,255,159,0.5)', letterSpacing: '0.25em' }}>NON-CUSTODIAL // MAINNET</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isConnected && (
            <button onClick={doCheckin} disabled={checkedIn || checking}
              style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', padding: '6px 10px', borderRadius: 7, cursor: checkedIn ? 'default' : 'pointer', fontFamily: 'inherit', border: checkedIn ? '1px solid rgba(0,255,159,0.2)' : '1px solid rgba(0,255,159,0.5)', background: checkedIn ? 'rgba(0,255,159,0.05)' : 'rgba(0,255,159,0.12)', color: checkedIn ? 'rgba(0,255,159,0.4)' : '#00ff9f' }}>
              {checking ? '...' : checkedIn ? `✓ ${streak.current}d` : `▶ CHECK_IN`}
            </button>
          )}
          <button onClick={isConnected ? disconnect : connect}
            style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', padding: '6px 10px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit', background: isConnected ? 'rgba(255,68,68,0.08)' : 'rgba(255,255,255,0.06)', border: isConnected ? '1px solid rgba(255,68,68,0.25)' : '1px solid rgba(255,255,255,0.12)', color: isConnected ? '#ff6666' : 'rgba(255,255,255,0.5)' }}>
            {isConnected ? short(address!) : 'CONNECT'}
          </button>
        </div>
      </header>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#050508', position: 'sticky', top: 58, zIndex: 40 }}>
        {(['chat', 'portfolio', 'streak', 'withdraw'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '10px 4px', fontSize: 8, letterSpacing: '0.2em', fontFamily: 'inherit', cursor: 'pointer', background: 'none', border: 'none', borderBottom: tab === t ? '2px solid #00ff9f' : '2px solid transparent', color: tab === t ? '#00ff9f' : 'rgba(255,255,255,0.25)', fontWeight: tab === t ? 700 : 400, textTransform: 'uppercase' }}>
            {t === 'withdraw' ? '⬆ OUT' : t}
          </button>
        ))}
      </div>

      {/* ── CHAT TAB ── */}
      {tab === 'chat' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', paddingBottom: 80 }}>

            {/* Welcome */}
            {msgs.length === 0 && (
              <div style={{ padding: '20px', borderRadius: 14, background: 'rgba(0,255,159,0.03)', border: '1px solid rgba(0,255,159,0.1)', marginBottom: 16 }}>
                <p style={{ fontSize: 10, color: '#00ff9f', letterSpacing: '0.2em', marginBottom: 8 }}>🤖 STACKS_AGENT READY</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, marginBottom: 14 }}>
                  Your intelligent crypto assistant on Stacks Bitcoin L2. I guide you through swaps, bridges, staking, and DeFi — you always keep control of your funds.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {['What is my portfolio?', 'Swap 10 STX for $B2S', 'How do I earn yield?', 'Bridge from Base', 'How do streaks work?', 'What is sBTC?'].map(s => (
                    <button key={s} onClick={() => setInput(s)} style={{ fontSize: 9, padding: '5px 9px', borderRadius: 6, letterSpacing: '0.08em', fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {msgs.map((m, i) => (
              <div key={i} style={{ marginBottom: 14, display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '88%', padding: '12px 14px', borderRadius: 12, background: m.role === 'user' ? 'rgba(255,255,255,0.07)' : 'rgba(0,255,159,0.04)', border: m.role === 'user' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,255,159,0.12)' }}>
                  {m.role === 'assistant' && <p style={{ fontSize: 7, color: 'rgba(0,255,159,0.5)', letterSpacing: '0.25em', marginBottom: 5 }}>AGENT</p>}
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                  {m.action && <ActionCard action={m.action} />}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', marginBottom: 14 }}>
                <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(0,255,159,0.04)', border: '1px solid rgba(0,255,159,0.12)' }}>
                  <p style={{ fontSize: 7, color: 'rgba(0,255,159,0.5)', letterSpacing: '0.25em', marginBottom: 5 }}>AGENT</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', margin: 0 }}>Thinking…</p>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '10px 12px', background: 'rgba(5,5,8,0.97)', borderTop: '1px solid rgba(255,255,255,0.06)', zIndex: 60 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {!isConnected && (
                <button onClick={connect} style={{ padding: '11px 14px', borderRadius: 9, fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', fontFamily: 'inherit', cursor: 'pointer', background: 'white', border: 'none', color: 'black', whiteSpace: 'nowrap' }}>CONNECT</button>
              )}
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} disabled={loading} placeholder={isConnected ? 'Ask anything...' : 'Connect to start'}
                style={{ flex: 1, padding: '11px 14px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: 12, fontFamily: 'inherit', outline: 'none', minWidth: 0 }} />
              <button onClick={send} disabled={!input.trim() || loading}
                style={{ padding: '11px 16px', borderRadius: 9, fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', fontFamily: 'inherit', cursor: input.trim() ? 'pointer' : 'not-allowed', background: input.trim() ? '#00ff9f' : 'rgba(255,255,255,0.05)', border: 'none', color: input.trim() ? 'black' : 'rgba(255,255,255,0.2)', whiteSpace: 'nowrap' }}>SEND</button>
            </div>
          </div>
        </div>
      )}

      {/* ── PORTFOLIO TAB ── */}
      {tab === 'portfolio' && (
        <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.25em' }}>
              {isConnected ? short(address!) : 'NOT CONNECTED'}
            </span>
            <button onClick={fetchPortfolio} style={{ fontSize: 9, padding: '4px 10px', borderRadius: 6, fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)' }}>
              ↻ REFRESH
            </button>
          </div>

          {!isConnected ? (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
              <button onClick={connect} style={{ padding: '12px 24px', borderRadius: 10, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'inherit', cursor: 'pointer', background: 'white', border: 'none', color: 'black' }}>CONNECT_WALLET</button>
            </div>
          ) : portLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>Loading balances…</div>
          ) : (
            <>
              {/* Total */}
              <div style={{ padding: '20px', borderRadius: 14, background: 'rgba(0,255,159,0.04)', border: '1px solid rgba(0,255,159,0.12)', marginBottom: 14, textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'rgba(0,255,159,0.5)', letterSpacing: '0.25em', marginBottom: 4 }}>TOTAL_TOKENS</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#00ff9f' }}>{Object.keys(port).length}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>assets on Stacks mainnet</div>
              </div>

              {/* Token list */}
              {Object.entries(port).map(([token, bal]) => (
                <div key={token} style={{ padding: '14px 16px', borderRadius: 12, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${TOKEN_COLOR[token] || '#fff'}06`, border: `1px solid ${TOKEN_COLOR[token] || '#fff'}18`, position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min((bal / (totalPortfolio || 1)) * 100, 100)}%`, background: `${TOKEN_COLOR[token] || '#fff'}06`, transition: 'width 0.8s ease' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: TOKEN_COLOR[token] || '#fff' }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{token}</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: TOKEN_COLOR[token] || '#fff', position: 'relative' }}>
                    {bal >= 1000 ? `${(bal / 1000).toFixed(2)}K` : bal.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                  </span>
                </div>
              ))}

              {/* Quick actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 16 }}>
                <a href="https://app.velar.co" target="_blank" rel="noopener noreferrer" style={{ padding: '12px', borderRadius: 10, textAlign: 'center', textDecoration: 'none', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)' }}>
                  SWAP ON VELAR ↗
                </a>
                <a href="https://app.alexlab.co/swap" target="_blank" rel="noopener noreferrer" style={{ padding: '12px', borderRadius: 10, textAlign: 'center', textDecoration: 'none', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)' }}>
                  SWAP ON ALEX ↗
                </a>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── STREAK TAB ── */}
      {tab === 'streak' && (
        <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>

          {/* Check-in card */}
          <div style={{ padding: '24px', borderRadius: 16, textAlign: 'center', marginBottom: 14, background: checkedIn ? 'rgba(0,255,159,0.04)' : 'rgba(255,215,0,0.04)', border: checkedIn ? '1px solid rgba(0,255,159,0.2)' : '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{checkedIn ? '✅' : '🔥'}</div>
            <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', color: checkedIn ? '#00ff9f' : '#ffd700', marginBottom: 4 }}>
              {checkedIn ? 'CHECKED_IN_TODAY' : 'CHECK_IN_NOW'}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>
              {checkedIn ? `Come back tomorrow · Streak: ${streak.current} days` : '0.001 STX · Builds streak · Earns rewards'}
            </p>
            {!checkedIn && (
              <button onClick={doCheckin} disabled={!isConnected || checking}
                style={{ padding: '12px 28px', borderRadius: 10, fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'inherit', cursor: isConnected ? 'pointer' : 'not-allowed', background: isConnected ? '#ffd700' : 'rgba(255,255,255,0.1)', border: 'none', color: isConnected ? 'black' : 'rgba(255,255,255,0.3)' }}>
                {checking ? 'CONFIRMING…' : isConnected ? '▶ CHECK_IN · 0.001 STX' : 'CONNECT WALLET'}
              </button>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { l: 'CURRENT', v: `${streak.current}d`, c: '#ffd700' },
              { l: 'BEST',    v: `${streak.best}d`,    c: '#ff00ff' },
              { l: 'TOTAL',   v: streak.total,          c: '#00d4ff' },
              { l: 'NEXT_BONUS', v: `${7 - (streak.current % 7) || 7}d`, c: '#00ff9f' },
            ].map(s => (
              <div key={s.l} style={{ padding: '16px', borderRadius: 12, background: `${s.c}06`, border: `1px solid ${s.c}18` }}>
                <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.2em', marginBottom: 4 }}>{s.l}</p>
                <p style={{ fontSize: 22, fontWeight: 700, color: s.c, margin: 0 }}>{s.v}</p>
              </div>
            ))}
          </div>

          {/* Milestones */}
          <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', marginBottom: 12 }}>STREAK_BONUSES</p>
            {[{ days: 7, bonus: '+0.002 STX', icon: '🥈' }, { days: 30, bonus: '+0.01 STX', icon: '🥇' }, { days: 100, bonus: '+0.05 STX', icon: '💎' }].map(b => (
              <div key={b.days} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{b.icon}</span>
                  <span style={{ fontSize: 10, color: streak.current >= b.days ? 'white' : 'rgba(255,255,255,0.3)' }}>{b.days}-DAY STREAK</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: streak.current >= b.days ? '#00ff9f' : 'rgba(255,255,255,0.2)' }}>{b.bonus}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── WITHDRAW TAB ── */}
      {tab === 'withdraw' && (
        <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
          <div style={{ padding: '20px', borderRadius: 14, background: 'rgba(255,68,68,0.04)', border: '1px solid rgba(255,68,68,0.15)', marginBottom: 16 }}>
            <p style={{ fontSize: 10, color: '#ff6666', letterSpacing: '0.2em', marginBottom: 6 }}>⚠ OWNER_ONLY</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>Withdraw treasury STX collected from check-in fees. Only the contract owner can call this function.</p>
          </div>

          {!isConnected ? (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <button onClick={connect} style={{ padding: '12px 24px', borderRadius: 10, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'inherit', cursor: 'pointer', background: 'white', border: 'none', color: 'black' }}>CONNECT_WALLET</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', marginBottom: 6 }}>AMOUNT (STX)</p>
                <input type="number" value={withdrawAmt} onChange={e => { setWithdrawAmt(e.target.value); setWithdrawErr(null) }} placeholder="0.00"
                  style={{ width: '100%', padding: '14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: 22, fontWeight: 700, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {[0.01, 0.05, 0.1, 0.5].map(v => (
                  <button key={v} onClick={() => setWithdrawAmt(String(v))}
                    style={{ flex: 1, padding: '8px', borderRadius: 7, fontSize: 10, fontFamily: 'inherit', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}>
                    {v}
                  </button>
                ))}
              </div>

              {withdrawErr && (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,68,68,0.07)', border: '1px solid rgba(255,68,68,0.2)', fontSize: 10, color: '#ff6666' }}>
                  ⚠ {withdrawErr}
                </div>
              )}

              {withdrawTx && (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.2)', fontSize: 10, color: '#00ff9f' }}>
                  ✅ TX: <a href={`https://explorer.hiro.so/txid/${withdrawTx}?chain=mainnet`} target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff', textDecoration: 'none' }}>{withdrawTx.slice(0, 16)}…↗</a>
                </div>
              )}

              <button onClick={doWithdraw} disabled={!withdrawAmt || withdrawing}
                style={{ padding: '14px', borderRadius: 10, fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'inherit', cursor: withdrawAmt ? 'pointer' : 'not-allowed', background: withdrawAmt ? '#ff6666' : 'rgba(255,255,255,0.05)', border: 'none', color: withdrawAmt ? 'white' : 'rgba(255,255,255,0.2)' }}>
                {withdrawing ? 'CONFIRMING…' : `⬆ WITHDRAW ${withdrawAmt || '0'} STX`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <footer style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.1)', letterSpacing: '0.15em' }}>POWERED BY GROQ + STACKS</span>
        <a href="https://base2stacks-tracker.vercel.app" target="_blank" rel="noopener noreferrer" style={{ fontSize: 8, color: 'rgba(255,255,255,0.15)', textDecoration: 'none', letterSpacing: '0.15em' }}>BASE2STACKS ↗</a>
      </footer>
    </div>
  )
}