'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useWallet } from '../../hooks/useWallet'
import { SwapCard } from '../../components/SwapCard'

const CONTRACT = 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const AGENT_V3 = 'stacks-quest-agent-v3'
const BRIDGE_URL = 'https://base2stacks-tracker.vercel.app'

type Msg = { role: 'user' | 'assistant'; content: string; action?: any; ts?: string }
type Tab = 'chat' | 'portfolio' | 'streak' | 'withdraw'
type Portfolio = Record<string, number>
type Streak = { current: number; best: number; total: number }
type Lang = 'EN' | 'FR' | 'ES' | 'ZH' | 'AR' | 'PT'

const LANGS: Record<Lang, { placeholder: string; connect: string; send: string; ready: string; suggestions: string[] }> = {
  EN: { placeholder: 'Enter command...', connect: 'CONNECT_WALLET', send: 'SEND', ready: 'STACKS_AGENT v3.0 INITIALIZED\nConnecting to Stacks mainnet...\nStatus: ONLINE\nNon-custodial DeFi assistant ready.', suggestions: ['Show my portfolio', 'Swap 10 STX for WELSH', 'Best staking options', 'Bridge from Base', 'Check my streak'] },
  FR: { placeholder: 'Entrez une commande...', connect: 'CONNECTER', send: 'ENVOYER', ready: 'STACKS_AGENT v3.0 INITIALISÉ\nConnexion à Stacks mainnet...\nStatut: EN LIGNE\nAssistant DeFi non-custodial prêt.', suggestions: ['Mon portefeuille', 'Swap 10 STX en WELSH', 'Meilleures options de staking', 'Bridge depuis Base', 'Mon streak'] },
  ES: { placeholder: 'Ingrese comando...', connect: 'CONECTAR', send: 'ENVIAR', ready: 'STACKS_AGENT v3.0 INICIALIZADO\nConectando a Stacks mainnet...\nEstado: EN LÍNEA\nAsistente DeFi no-custodial listo.', suggestions: ['Mi portfolio', 'Swap 10 STX por WELSH', 'Mejores opciones staking', 'Bridge desde Base', 'Mi racha'] },
  ZH: { placeholder: '输入命令...', connect: '连接钱包', send: '发送', ready: 'STACKS_AGENT v3.0 已初始化\n连接到 Stacks 主网...\n状态: 在线\n非托管 DeFi 助手就绪。', suggestions: ['查看我的投资组合', '用10 STX换WELSH', '最佳质押选项', '从Base跨链', '查看连续打卡'] },
  AR: { placeholder: 'أدخل أمراً...', connect: 'ربط المحفظة', send: 'إرسال', ready: 'STACKS_AGENT v3.0 تم التهيئة\nجاري الاتصال بـ Stacks mainnet...\nالحالة: متصل\nمساعد DeFi غير حضاني جاهز.', suggestions: ['عرض محفظتي', 'تبادل 10 STX مقابل WELSH', 'أفضل خيارات التحصيص', 'جسر من Base', 'تحقق من سلسلتي'] },
  PT: { placeholder: 'Digite um comando...', connect: 'CONECTAR', send: 'ENVIAR', ready: 'STACKS_AGENT v3.0 INICIALIZADO\nConectando ao Stacks mainnet...\nStatus: ONLINE\nAssistente DeFi não-custodial pronto.', suggestions: ['Meu portfólio', 'Trocar 10 STX por WELSH', 'Melhores opções de staking', 'Bridge do Base', 'Minha sequência'] },
}

const QUICK_ACTIONS = [
  { id: 'portfolio',  label: 'PORTFOLIO',    icon: '◈', color: '#00d4ff', cmd: 'Show my portfolio' },
  { id: 'swap',       label: 'SWAP',         icon: '⇄', color: '#00ff9f', cmd: 'Swap 10 STX for WELSH' },
  { id: 'stake',      label: 'STAKING',      icon: '⬡', color: '#ffd700', cmd: 'Show best staking options with APY' },
  { id: 'bridge',     label: 'BRIDGE',       icon: '⟷', color: '#ff6b9d', cmd: 'How to bridge from Base to Stacks' },
  { id: 'checkin',    label: 'CHECK_IN',     icon: '▶', color: '#00ff9f', cmd: 'Daily check-in' },
  { id: 'trade',      label: 'TRADE_IDEAS',  icon: '⚡', color: '#ff9f43', cmd: 'Show best trading opportunities on Stacks right now' },
]

const STAKING_OPTIONS = [
  { name: '$B2S Vault v2',    apy: '37.5%', lock: '365d', risk: 'LOW',  protocol: 'Base2Stacks', color: '#00ff9f' },
  { name: '$B2S Vault v2',    apy: '25%',   lock: '70d',  risk: 'LOW',  protocol: 'Base2Stacks', color: '#00ff9f' },
  { name: '$B2S Vault v2',    apy: '12.5%', lock: 'None', risk: 'LOW',  protocol: 'Base2Stacks', color: '#00ff9f' },
  { name: 'STX Stacking',     apy: '~8%',   lock: '2w',   risk: 'LOW',  protocol: 'Proof of Transfer', color: '#9945ff' },
  { name: 'STX/WELSH LP',     apy: 'var.',  lock: 'None', risk: 'MED',  protocol: 'Velar DEX', color: '#ff6b9d' },
  { name: 'STX/aeUSDC LP',    apy: 'var.',  lock: 'None', risk: 'LOW',  protocol: 'Velar DEX', color: '#2775ca' },
]

const TOKEN_COLOR: Record<string, string> = {
  STX: '#9945ff', '$B2S': '#00ff9f', sBTC: '#f7931a',
  aeUSDC: '#2775ca', ALEX: '#00d4ff', WELSH: '#ff6b9d',
  VELAR: '#00ff9f', LEO: '#ffd700',
}

function ActionCard({ action, address }: { action: any; address: string | null }) {
  if (!action?.type) return null
  if (action.type === 'swap') return <SwapCard action={action} address={address} />
  if (action.type === 'bridge') {
    return (
      <div style={{ marginTop: 10, padding: '12px', borderRadius: 8, background: 'rgba(255,165,0,0.05)', border: '1px solid rgba(255,165,0,0.25)' }}>
        <div style={{ fontSize: 8, color: 'rgba(255,165,0,0.6)', letterSpacing: '0.2em', marginBottom: 6 }}>// BRIDGE {action.fromChain?.toUpperCase()} → {action.toChain?.toUpperCase()}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#ffaa00', marginBottom: 10 }}>{action.amount} {action.token}</div>
        <a href={BRIDGE_URL} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, padding: '6px 14px', borderRadius: 6, background: '#ffaa00', color: 'black', textDecoration: 'none', fontFamily: 'inherit', letterSpacing: '0.15em', fontWeight: 700 }}>▶ OPEN BRIDGE ↗</a>
      </div>
    )
  }
  if (action.type === 'checkin') {
    return (
      <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)', fontSize: 9, color: '#ffd700' }}>
        💰 0.001 STX · streak bonus at 7/30/100 days → use STREAK tab
      </div>
    )
  }
  return null
}

async function callContract(name: string, fn: string, args: any[], onFinish: (txid: string) => void, onCancel: () => void) {
  try {
    const { openContractCall } = await import('@stacks/connect')
    const stacks = await import('@stacks/transactions')
    await openContractCall({
      contractAddress: CONTRACT, contractName: name, functionName: fn, functionArgs: args,
      postConditionMode: stacks.PostConditionMode.Allow, network: 'mainnet' as any,
      onFinish: (d: any) => { const tx = d?.txId || d?.txid; if (tx) onFinish(tx); else onCancel() },
      onCancel,
    })
  } catch (e: any) { console.error(e); onCancel() }
}

export default function AgentTerminal() {
  const { mounted, isConnected, address, connect, disconnect } = useWallet()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('chat')
  const [port, setPort] = useState<Portfolio>({})
  const [portLoading, setPortLoading] = useState(false)
  const [streak, setStreak] = useState<Streak>({ current: 0, best: 0, total: 0 })
  const [checkedIn, setCheckedIn] = useState(false)
  const [checking, setChecking] = useState(false)
  const [withdrawAmt, setWithdrawAmt] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawTx, setWithdrawTx] = useState<string | null>(null)
  const [withdrawErr, setWithdrawErr] = useState<string | null>(null)
  const [lang, setLang] = useState<Lang>('EN')
  const [block, setBlock] = useState(0)
  const [stxPrice, setStxPrice] = useState(0)
  const [networkLatency, setNetworkLatency] = useState(0)
  const [showStaking, setShowStaking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const L = LANGS[lang]
  const short = (a: string) => `${a.slice(0, 6)}...${a.slice(-4)}`

  // Fetch network stats
  const fetchNetworkStats = useCallback(async () => {
    const t0 = Date.now()
    try {
      const res  = await fetch('https://api.mainnet.hiro.so/v2/info')
      const data = await res.json()
      setBlock(data.stacks_tip_height || 0)
      setNetworkLatency(Date.now() - t0)
    } catch {}
    try {
      const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd')
      const data = await res.json()
      setStxPrice(data.blockstack?.usd || 0)
    } catch {}
  }, [])

  useEffect(() => {
    fetchNetworkStats()
    const t = setInterval(fetchNetworkStats, 30000)
    return () => clearInterval(t)
  }, [fetchNetworkStats])

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

  const fetchPortfolio = useCallback(async () => {
    if (!address) return
    setPortLoading(true)
    try {
      const res  = await fetch(`/api/hiro?path=${encodeURIComponent(`/extended/v1/address/${address}/balances`)}`)
      const data = await res.json()
      const p: Portfolio = { STX: Number(data.stx?.balance || 0) / 1_000_000 }
      const fts = data.fungible_tokens || {}
      for (const [k, v] of Object.entries(fts) as any[]) {
        if (k.includes('b2s-token'))  p['$B2S']  = Number((v as any).balance) / 1_000_000
        if (k.includes('sbtc-token')) p['sBTC']  = Number((v as any).balance) / 1e8
        if (k.includes('token-alex')) p['ALEX']  = Number((v as any).balance) / 1e8
        if (k.includes('welshcorgi')) p['WELSH'] = Number((v as any).balance) / 1_000_000
        if (k.includes('aeusdc'))     p['aeUSDC']= Number((v as any).balance) / 1_000_000
        if (k.includes('velar-token'))p['VELAR'] = Number((v as any).balance) / 1_000_000
      }
      setPort(p)
    } catch {}
    setPortLoading(false)
  }, [address])

  useEffect(() => { if (isConnected && address) fetchPortfolio() }, [isConnected, address, fetchPortfolio])

  useEffect(() => {
    const last = msgs[msgs.length - 1]
    if (last?.role === 'assistant' && last.action?.type === 'query') {
      setTab('portfolio'); fetchPortfolio()
    }
  }, [msgs, fetchPortfolio])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const send = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    const userMsg: Msg = { role: 'user', content: msg, ts: new Date().toLocaleTimeString('en', { hour12: false }) }
    setMsgs(m => [...m, userMsg]); setInput(''); setLoading(true)
    try {
      const systemLang = lang !== 'EN' ? `\nIMPORTANT: Respond in ${lang === 'FR' ? 'French' : lang === 'ES' ? 'Spanish' : lang === 'ZH' ? 'Chinese' : lang === 'AR' ? 'Arabic' : 'Portuguese'}.` : ''
      const res = await fetch('/api/agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...msgs, userMsg].map(m => ({ role: m.role, content: m.content })), address, systemExtra: systemLang }),
      })
      const data = await res.json()
      setMsgs(m => [...m, { role: 'assistant', content: data.content || '...', action: data.action, ts: new Date().toLocaleTimeString('en', { hour12: false }) }])
    } catch { setMsgs(m => [...m, { role: 'assistant', content: '⚠ CONNECTION_ERROR', ts: new Date().toLocaleTimeString('en', { hour12: false }) }]) }
    setLoading(false)
  }

  const doCheckin = async () => {
    if (!isConnected || checkedIn || checking) return
    setChecking(true)
    await callContract(AGENT_V3, 'daily-checkin', [],
      (txid) => {
        const today = Math.floor(Date.now() / (144 * 10 * 60 * 1000))
        const ns = { current: streak.current + 1, best: Math.max(streak.best, streak.current + 1), total: streak.total + 1 }
        setStreak(ns); setCheckedIn(true)
        localStorage.setItem(`sq_streak_${address}`, JSON.stringify({ current_streak: ns.current, best_streak: ns.best, total_checkins: ns.total, last_checkin_day: today }))
        setMsgs(m => [...m, { role: 'assistant', content: `✅ CHECK_IN CONFIRMED\nStreak: ${ns.current} days 🔥\n${ns.current % 7 === 0 ? '🎉 7-day bonus earned!' : `${7 - (ns.current % 7)} days until bonus`}\n\nTX: ${txid}`, ts: new Date().toLocaleTimeString('en', { hour12: false }) }])
        setChecking(false)
      },
      () => { setMsgs(m => [...m, { role: 'assistant', content: '⚠ CHECK_IN_CANCELLED', ts: new Date().toLocaleTimeString('en', { hour12: false }) }]); setChecking(false) }
    )
  }

  const doWithdraw = async () => {
    if (!isConnected || !withdrawAmt || withdrawing) return
    const amt = parseFloat(withdrawAmt)
    if (isNaN(amt) || amt <= 0) { setWithdrawErr('INVALID_AMOUNT'); return }
    setWithdrawing(true); setWithdrawErr(null); setWithdrawTx(null)
    const stacks = await import('@stacks/transactions')
    await callContract(AGENT_V3, 'withdraw-treasury', [stacks.uintCV(Math.round(amt * 1_000_000))],
      (txid) => { setWithdrawTx(txid); setWithdrawAmt(''); setWithdrawing(false) },
      () => { setWithdrawErr('CANCELLED'); setWithdrawing(false) }
    )
  }

  if (!mounted) return null

  const MONO = "'JetBrains Mono','Fira Code','Courier New',monospace"
  const totalPort = Object.values(port).reduce((a, b) => a + b, 0)

  return (
    <div style={{ fontFamily: MONO, minHeight: '100dvh', background: '#030407', color: '#e0e0e0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── TOP STATUS BAR ── */}
      <div style={{ background: '#0a0d12', borderBottom: '1px solid #1a2030', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 9, letterSpacing: '0.15em' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: 'rgba(0,255,159,0.15)', border: '1px solid rgba(0,255,159,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>⬡</div>
          <span style={{ color: '#00ff9f', fontWeight: 700, letterSpacing: '0.2em' }}>STACKS_AGENT</span>
          <span style={{ color: '#334' }}>v3.0</span>
        </div>
        <div style={{ width: 1, height: 12, background: '#1a2030' }} />
        <span style={{ color: '#00ff9f' }}>STX/USD <span style={{ color: '#ffd700', fontWeight: 700 }}>${stxPrice.toFixed(4)}</span></span>
        <div style={{ width: 1, height: 12, background: '#1a2030' }} />
        <span style={{ color: '#556' }}>GAS: <span style={{ color: '#00ff9f' }}>&lt;$0.001</span></span>
        <div style={{ width: 1, height: 12, background: '#1a2030' }} />
        <span style={{ color: '#556' }}>NET: <span style={{ color: '#9945ff' }}>STACKS</span></span>
        <div style={{ width: 1, height: 12, background: '#1a2030' }} />
        <span style={{ color: '#556' }}>BLOCK: <span style={{ color: '#00d4ff' }}>#{block.toLocaleString()}</span></span>
        <div style={{ flex: 1 }} />
        {/* Language selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(Object.keys(LANGS) as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)}
              style={{ padding: '2px 6px', borderRadius: 3, fontSize: 8, fontFamily: MONO, cursor: 'pointer', letterSpacing: '0.1em', background: lang === l ? 'rgba(0,255,159,0.15)' : 'transparent', border: lang === l ? '1px solid rgba(0,255,159,0.4)' : '1px solid transparent', color: lang === l ? '#00ff9f' : '#445' }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 12, background: '#1a2030' }} />
        <button onClick={isConnected ? disconnect : connect}
          style={{ padding: '4px 12px', borderRadius: 4, fontSize: 9, fontFamily: MONO, cursor: 'pointer', letterSpacing: '0.15em', fontWeight: 700, background: isConnected ? 'rgba(255,68,68,0.1)' : 'rgba(0,255,159,0.1)', border: isConnected ? '1px solid rgba(255,68,68,0.3)' : '1px solid rgba(0,255,159,0.3)', color: isConnected ? '#ff6666' : '#00ff9f' }}>
          {isConnected ? short(address!) : L.connect}
        </button>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '180px 1fr 200px', overflow: 'hidden', minHeight: 0 }}>

        {/* ── LEFT: QUICK ACTIONS ── */}
        <div style={{ background: '#070a0f', borderRight: '1px solid #1a2030', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px 6px', fontSize: 8, color: '#334', letterSpacing: '0.2em' }}>// QUICK_ACTIONS</div>

          {QUICK_ACTIONS.map(a => (
            <button key={a.id} onClick={() => { send(a.cmd); setShowStaking(a.id === 'stake') }}
              style={{ padding: '8px 12px', fontSize: 9, fontFamily: MONO, letterSpacing: '0.12em', cursor: 'pointer', background: 'transparent', border: 'none', borderBottom: '1px solid #0d1118', color: '#667', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.1s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${a.color}10`; (e.currentTarget as HTMLElement).style.color = a.color }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#667' }}>
              <span style={{ width: 14, textAlign: 'center', opacity: 0.7 }}>{a.icon}</span>
              {a.label}
            </button>
          ))}

          <div style={{ padding: '10px 12px 6px', marginTop: 8, fontSize: 8, color: '#334', letterSpacing: '0.2em' }}>// STAKING_OPTIONS</div>

          {STAKING_OPTIONS.map((s, i) => (
            <div key={i} style={{ padding: '6px 12px', borderBottom: '1px solid #0d1118', cursor: 'pointer' }}
              onClick={() => send(`Tell me about staking in ${s.name} on ${s.protocol}`)}>
              <div style={{ fontSize: 8, color: s.color, letterSpacing: '0.1em', marginBottom: 2 }}>{s.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: s.color }}>{s.apy} APY</span>
                <span style={{ fontSize: 7, color: '#445', letterSpacing: '0.1em' }}>LOCK:{s.lock}</span>
              </div>
            </div>
          ))}

          <div style={{ flex: 1 }} />

          {/* Streak indicator */}
          {isConnected && (
            <div style={{ padding: '10px 12px', borderTop: '1px solid #1a2030' }}>
              <div style={{ fontSize: 7, color: '#334', letterSpacing: '0.15em', marginBottom: 4 }}>// STREAK</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: checkedIn ? '#00ff9f' : '#ffd700' }}>🔥 {streak.current}d</div>
              <button onClick={doCheckin} disabled={checkedIn || checking}
                style={{ marginTop: 6, width: '100%', padding: '5px', borderRadius: 4, fontSize: 8, fontFamily: MONO, letterSpacing: '0.1em', cursor: checkedIn ? 'default' : 'pointer', background: checkedIn ? 'rgba(0,255,159,0.05)' : 'rgba(0,255,159,0.12)', border: checkedIn ? '1px solid rgba(0,255,159,0.15)' : '1px solid rgba(0,255,159,0.4)', color: checkedIn ? 'rgba(0,255,159,0.3)' : '#00ff9f' }}>
                {checking ? '...' : checkedIn ? '✓ DONE' : '▶ CHECK_IN'}
              </button>
            </div>
          )}
        </div>

        {/* ── CENTER: TERMINAL ── */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#050810' }}>

          {/* Tab bar */}
          <div style={{ display: 'flex', borderBottom: '1px solid #1a2030', background: '#070a0f' }}>
            <div style={{ padding: '6px 14px', fontSize: 8, color: '#445', letterSpacing: '0.2em', borderRight: '1px solid #1a2030' }}>TERMINAL://stacks/agent</div>
            {(['chat', 'portfolio', 'streak', 'withdraw'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '6px 14px', fontSize: 8, letterSpacing: '0.15em', fontFamily: MONO, cursor: 'pointer', background: 'none', border: 'none', borderBottom: tab === t ? '1px solid #00ff9f' : '1px solid transparent', color: tab === t ? '#00ff9f' : '#445', textTransform: 'uppercase' }}>
                {t === 'withdraw' ? '⬆ OUT' : t}
              </button>
            ))}
          </div>

          {/* CHAT */}
          {tab === 'chat' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 0 }}>

                {/* Boot message */}
                {msgs.length === 0 && (
                  <div style={{ marginBottom: 16, padding: '14px', borderRadius: 6, background: 'rgba(0,255,159,0.03)', border: '1px solid #1a2030' }}>
                    <div style={{ fontSize: 8, color: '#445', letterSpacing: '0.2em', marginBottom: 8 }}>CELOBANK_AI · {new Date().toLocaleTimeString('en', { hour12: false })}</div>
                    {L.ready.split('\n').map((line, i) => (
                      <div key={i} style={{ fontSize: 11, color: i === 0 ? '#00ff9f' : i === 2 ? '#00ff9f' : '#667', lineHeight: 1.8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {i === 2 && <div style={{ width: 60, height: 4, background: '#00ff9f', borderRadius: 2, opacity: 0.8 }} />}
                        {line}
                      </div>
                    ))}
                    <div style={{ marginTop: 12, fontSize: 10, color: '#556' }}>
                      {lang === 'FR' ? 'Sélectionnez une action ou entrez une commande.' : lang === 'ES' ? 'Seleccione una acción o ingrese un comando.' : lang === 'ZH' ? '选择一个操作或输入命令。' : 'Select an action or enter a command.'}
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {L.suggestions.map(s => (
                        <button key={s} onClick={() => send(s)}
                          style={{ fontSize: 8, padding: '3px 8px', borderRadius: 4, letterSpacing: '0.1em', fontFamily: MONO, cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid #1a2030', color: '#445' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#00ff9f'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,255,159,0.3)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#445'; (e.currentTarget as HTMLElement).style.borderColor = '#1a2030' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {msgs.map((m, i) => (
                  <div key={i} style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{ fontSize: 7, color: '#334', letterSpacing: '0.15em', marginBottom: 3 }}>
                      {m.role === 'user' ? (isConnected ? short(address!) : 'USER') : 'STACKS_AGENT'} · {m.ts}
                    </div>
                    <div style={{ maxWidth: '85%', padding: '10px 12px', borderRadius: 6, background: m.role === 'user' ? 'rgba(255,255,255,0.04)' : 'rgba(0,255,159,0.03)', border: m.role === 'user' ? '1px solid #1a2030' : '1px solid rgba(0,255,159,0.1)' }}>
                      {m.role === 'assistant' && (
                        <div style={{ fontSize: 8, color: 'rgba(0,255,159,0.4)', marginBottom: 4, letterSpacing: '0.15em' }}>{'> '}</div>
                      )}
                      <div style={{ fontSize: 11, color: m.role === 'user' ? '#889' : '#aab', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{m.content}</div>
                      {m.action && <ActionCard action={m.action} address={address} />}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 7, color: '#334', letterSpacing: '0.15em', marginBottom: 3 }}>STACKS_AGENT · processing</div>
                    <div style={{ padding: '10px 12px', borderRadius: 6, background: 'rgba(0,255,159,0.03)', border: '1px solid rgba(0,255,159,0.1)', fontSize: 11, color: 'rgba(0,255,159,0.4)' }}>
                      {'> '}<span style={{ animation: 'blink 1s infinite' }}>█</span>
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div style={{ padding: '10px 16px', borderTop: '1px solid #1a2030', background: '#070a0f', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#334', fontSize: 11 }}>{'> '}</span>
                {!isConnected && (
                  <button onClick={connect} style={{ padding: '8px 14px', borderRadius: 4, fontSize: 9, fontFamily: MONO, letterSpacing: '0.15em', cursor: 'pointer', background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', color: '#00ff9f', whiteSpace: 'nowrap', fontWeight: 700 }}>{L.connect}</button>
                )}
                <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()} disabled={loading} placeholder={L.placeholder}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid #1a2030', color: '#aab', fontSize: 11, fontFamily: MONO, outline: 'none', minWidth: 0 }} />
                <button onClick={() => send()} disabled={!input.trim() || loading}
                  style={{ padding: '8px 16px', borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: '0.15em', fontFamily: MONO, cursor: input.trim() ? 'pointer' : 'not-allowed', background: input.trim() ? 'rgba(0,255,159,0.15)' : 'transparent', border: input.trim() ? '1px solid rgba(0,255,159,0.4)' : '1px solid #1a2030', color: input.trim() ? '#00ff9f' : '#334', whiteSpace: 'nowrap' }}>{L.send} ▶</button>
              </div>
            </div>
          )}

          {/* PORTFOLIO */}
          {tab === 'portfolio' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              <div style={{ fontSize: 8, color: '#445', letterSpacing: '0.2em', marginBottom: 12 }}>// PORTFOLIO_SUMMARY · {isConnected ? short(address!) : 'NOT_CONNECTED'}</div>
              {!isConnected ? (
                <button onClick={connect} style={{ padding: '10px 20px', borderRadius: 4, fontSize: 10, fontFamily: MONO, cursor: 'pointer', background: 'rgba(0,255,159,0.1)', border: '1px solid rgba(0,255,159,0.3)', color: '#00ff9f', letterSpacing: '0.2em', fontWeight: 700 }}>{L.connect}</button>
              ) : portLoading ? (
                <div style={{ fontSize: 10, color: '#445' }}>Loading...</div>
              ) : (
                <div>
                  {Object.entries(port).map(([token, bal]) => (
                    <div key={token} style={{ padding: '10px 14px', marginBottom: 6, borderRadius: 4, background: `${TOKEN_COLOR[token] || '#fff'}06`, border: `1px solid ${TOKEN_COLOR[token] || '#fff'}18`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min((bal / (totalPort || 1)) * 100, 100)}%`, background: `${TOKEN_COLOR[token] || '#fff'}05` }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                        <div style={{ width: 6, height: 6, borderRadius: 1, background: TOKEN_COLOR[token] || '#fff' }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#aab' }}>{token}</span>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: TOKEN_COLOR[token] || '#fff', position: 'relative' }}>
                        {bal >= 1000 ? `${(bal / 1000).toFixed(2)}K` : bal.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </span>
                    </div>
                  ))}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
                    <a href="https://app.velar.co" target="_blank" rel="noopener noreferrer" style={{ padding: '10px', borderRadius: 4, textAlign: 'center', textDecoration: 'none', background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.15)', fontSize: 9, letterSpacing: '0.15em', color: '#00ff9f', fontFamily: MONO }}>VELAR DEX ↗</a>
                    <a href="https://app.alexlab.co/swap" target="_blank" rel="noopener noreferrer" style={{ padding: '10px', borderRadius: 4, textAlign: 'center', textDecoration: 'none', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', fontSize: 9, letterSpacing: '0.15em', color: '#00d4ff', fontFamily: MONO }}>ALEX DEX ↗</a>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STREAK */}
          {tab === 'streak' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              <div style={{ fontSize: 8, color: '#445', letterSpacing: '0.2em', marginBottom: 12 }}>// STREAK_STATUS</div>
              <div style={{ padding: '20px', borderRadius: 6, textAlign: 'center', marginBottom: 12, background: checkedIn ? 'rgba(0,255,159,0.04)' : 'rgba(255,215,0,0.04)', border: checkedIn ? '1px solid rgba(0,255,159,0.15)' : '1px solid rgba(255,215,0,0.15)' }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>{checkedIn ? '✅' : '🔥'}</div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', color: checkedIn ? '#00ff9f' : '#ffd700', marginBottom: 4 }}>{checkedIn ? 'CHECKED_IN_TODAY' : 'CHECK_IN_NOW'}</div>
                <div style={{ fontSize: 9, color: '#445', marginBottom: 14 }}>{checkedIn ? `Come back tomorrow · Streak: ${streak.current}` : '0.001 STX · Builds streak · Earns rewards'}</div>
                {!checkedIn && (
                  <button onClick={doCheckin} disabled={!isConnected || checking}
                    style={{ padding: '8px 20px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', fontFamily: MONO, cursor: isConnected ? 'pointer' : 'not-allowed', background: isConnected ? 'rgba(255,215,0,0.15)' : 'rgba(255,255,255,0.05)', border: isConnected ? '1px solid rgba(255,215,0,0.4)' : '1px solid #1a2030', color: isConnected ? '#ffd700' : '#445' }}>
                    {checking ? 'CONFIRMING…' : '▶ CHECK_IN · 0.001 STX'}
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                {[{ l: 'CURRENT', v: `${streak.current}d`, c: '#ffd700' }, { l: 'BEST', v: `${streak.best}d`, c: '#ff00ff' }, { l: 'TOTAL', v: streak.total, c: '#00d4ff' }, { l: 'NEXT_BONUS', v: `${7 - (streak.current % 7) || 7}d`, c: '#00ff9f' }].map(s => (
                  <div key={s.l} style={{ padding: '12px', borderRadius: 4, background: `${s.c}06`, border: `1px solid ${s.c}15` }}>
                    <div style={{ fontSize: 7, color: '#445', letterSpacing: '0.2em', marginBottom: 3 }}>{s.l}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.c }}>{s.v}</div>
                  </div>
                ))}
              </div>
              {[{ days: 7, bonus: '+0.002 STX', icon: '🥈' }, { days: 30, bonus: '+0.01 STX', icon: '🥇' }, { days: 100, bonus: '+0.05 STX', icon: '💎' }].map(b => (
                <div key={b.days} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #0d1118', fontSize: 9 }}>
                  <span style={{ color: streak.current >= b.days ? '#aab' : '#445' }}>{b.icon} {b.days}-DAY STREAK</span>
                  <span style={{ color: streak.current >= b.days ? '#00ff9f' : '#334', fontWeight: 700 }}>{b.bonus}</span>
                </div>
              ))}
            </div>
          )}

          {/* WITHDRAW */}
          {tab === 'withdraw' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
              <div style={{ fontSize: 8, color: '#445', letterSpacing: '0.2em', marginBottom: 12 }}>// WITHDRAW_TREASURY · OWNER_ONLY</div>
              <div style={{ padding: '12px', borderRadius: 4, background: 'rgba(255,68,68,0.04)', border: '1px solid rgba(255,68,68,0.1)', marginBottom: 14, fontSize: 10, color: '#556' }}>
                ⚠ Only contract owner can withdraw treasury STX from check-in fees.
              </div>
              {isConnected && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input type="number" value={withdrawAmt} onChange={e => { setWithdrawAmt(e.target.value); setWithdrawErr(null) }} placeholder="0.00 STX"
                    style={{ padding: '10px 12px', borderRadius: 4, background: 'rgba(255,255,255,0.03)', border: '1px solid #1a2030', color: '#aab', fontSize: 16, fontFamily: MONO, outline: 'none' }} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[0.01, 0.05, 0.1, 0.5].map(v => (
                      <button key={v} onClick={() => setWithdrawAmt(String(v))} style={{ flex: 1, padding: '6px', borderRadius: 4, fontSize: 9, fontFamily: MONO, cursor: 'pointer', background: 'rgba(255,255,255,0.03)', border: '1px solid #1a2030', color: '#556' }}>{v}</button>
                    ))}
                  </div>
                  {withdrawErr && <div style={{ fontSize: 9, color: '#ff6666', padding: '6px 10px', borderRadius: 4, background: 'rgba(255,68,68,0.05)', border: '1px solid rgba(255,68,68,0.15)' }}>⚠ {withdrawErr}</div>}
                  {withdrawTx && <div style={{ fontSize: 9, color: '#00ff9f', padding: '6px 10px', borderRadius: 4, background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.15)' }}>✅ <a href={`https://explorer.hiro.so/txid/${withdrawTx}?chain=mainnet`} target="_blank" rel="noopener noreferrer" style={{ color: '#00d4ff', textDecoration: 'none' }}>{withdrawTx.slice(0, 16)}…↗</a></div>}
                  <button onClick={doWithdraw} disabled={!withdrawAmt || withdrawing}
                    style={{ padding: '10px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', fontFamily: MONO, cursor: withdrawAmt ? 'pointer' : 'not-allowed', background: withdrawAmt ? 'rgba(255,68,68,0.1)' : 'transparent', border: withdrawAmt ? '1px solid rgba(255,68,68,0.3)' : '1px solid #1a2030', color: withdrawAmt ? '#ff6666' : '#334' }}>
                    {withdrawing ? 'CONFIRMING…' : `⬆ WITHDRAW ${withdrawAmt || '0'} STX`}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: NETWORK STATUS ── */}
        <div style={{ background: '#070a0f', borderLeft: '1px solid #1a2030', display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '10px' }}>
          <div style={{ fontSize: 8, color: '#334', letterSpacing: '0.2em', marginBottom: 10 }}>// NETWORK_STATUS</div>

          {[
            { label: 'CHAIN',    value: 'STACKS',  color: '#9945ff' },
            { label: 'LAYER',    value: 'BITCOIN L2', color: '#f7931a' },
            { label: 'RPC',      value: 'ONLINE',  color: '#00ff9f' },
            { label: 'LATENCY',  value: `${networkLatency}ms`, color: networkLatency < 200 ? '#00ff9f' : '#ffd700' },
            { label: 'BLOCK',    value: `#${block.toLocaleString()}`, color: '#00d4ff' },
          ].map(s => (
            <div key={s.label} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #0d1118' }}>
              <div style={{ fontSize: 7, color: '#334', letterSpacing: '0.15em', marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: s.color, letterSpacing: '0.1em' }}>{s.value}</div>
            </div>
          ))}

          <div style={{ fontSize: 8, color: '#334', letterSpacing: '0.2em', marginBottom: 8, marginTop: 4 }}>// AI_MODEL</div>
          <div style={{ fontSize: 8, color: '#556', marginBottom: 4 }}>GROQ_LLAMA3.3</div>
          <div style={{ fontSize: 8, color: '#556', marginBottom: 4 }}>70B_VERSATILE</div>
          <div style={{ fontSize: 8, color: '#556', marginBottom: 4 }}>TOOLS: ACTIVE</div>

          <div style={{ fontSize: 8, color: '#334', letterSpacing: '0.2em', marginBottom: 8, marginTop: 10 }}>// SELF_AGENT</div>
          <div style={{ fontSize: 8, color: '#556', marginBottom: 3 }}>NON-CUSTODIAL</div>
          <div style={{ fontSize: 8, color: '#556', marginBottom: 3 }}>XVERSE_WALLET</div>
          <div style={{ fontSize: 8, color: '#556', marginBottom: 3 }}>ONCHAIN_ID</div>

          <div style={{ flex: 1 }} />

          <div style={{ fontSize: 8, color: '#334', letterSpacing: '0.2em', marginBottom: 8 }}>// IMPACT</div>
          <div style={{ fontSize: 8, color: '#00ff9f', marginBottom: 3 }}>87 VELAR POOLS</div>
          <div style={{ fontSize: 8, color: '#9945ff', marginBottom: 3 }}>NATIVE SWAPS</div>
          <div style={{ fontSize: 8, color: '#f7931a', marginBottom: 8 }}>BITCOIN L2</div>

          <a href="https://explorer.hiro.so/address/SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N?chain=mainnet" target="_blank" rel="noopener noreferrer"
            style={{ padding: '6px', borderRadius: 4, textAlign: 'center', textDecoration: 'none', background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.15)', fontSize: 8, letterSpacing: '0.12em', color: '#00ff9f', fontFamily: MONO }}>
            EXPLORER ↗
          </a>
        </div>
      </div>

      {/* ── BOTTOM STATUS BAR ── */}
      <div style={{ background: '#0a0d12', borderTop: '1px solid #1a2030', padding: '4px 16px', display: 'flex', gap: 16, fontSize: 8, letterSpacing: '0.12em', color: '#334' }}>
        <span>ENCRYPTED // TLS 1.3</span>
        <span>GAS: ~0.003 STX</span>
        <span>STACKS_MAINNET · #{block}</span>
        <span>GROQ_LLAMA3.3 · 70B</span>
        <div style={{ flex: 1 }} />
        <a href="https://base2stacks-tracker.vercel.app" target="_blank" rel="noopener noreferrer" style={{ color: '#445', textDecoration: 'none' }}>BASE2STACKS_TRACKER ↗</a>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #070a0f; }
        ::-webkit-scrollbar-thumb { background: #1a2030; border-radius: 2px; }
      `}</style>
    </div>
  )
}