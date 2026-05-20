'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '../hooks/useWallet'

const MONO = { fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace" }

const PUZZLES = [
  { id: 'block-height', label: 'BLOCK_HEIGHT',    hint: 'What is the current Stacks block height?',     unit: 'blocks',  tip: 'explorer.hiro.so' },
  { id: 'stakers',      label: 'TOTAL_STAKERS',   hint: 'How many wallets are staking $B2S right now?',  unit: 'wallets', tip: 'stacking vault on-chain' },
  { id: 'tx-count',     label: 'TX_COUNT_24H',    hint: 'How many Stacks transactions in the last 24h?', unit: 'txs',     tip: 'api.mainnet.hiro.so' },
  { id: 'stx-price',    label: 'STX_PRICE_CENTS', hint: 'What is the STX price in cents right now?',    unit: 'cents',   tip: 'CoinGecko / Binance' },
]

type State = 'idle' | 'playing' | 'submitting' | 'won' | 'lost'
type Hint  = 'hot' | 'warm' | 'cold' | null

function Logo() {
  return (
    <svg width="38" height="38" viewBox="0 0 48 48" fill="none">
      <polygon points="24,3 43,13.5 43,34.5 24,45 5,34.5 5,13.5"
        stroke="white" strokeWidth="1.5" fill="none"/>
      <text x="24" y="31" textAnchor="middle"
        style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 700, fill: 'white' }}>Q</text>
      <line x1="31" y1="33" x2="37" y2="39" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function Page() {
  const { mounted, isConnected, address, connect, disconnect, submitGuess } = useWallet()

  const [guess,   setGuess]   = useState('')
  const [bet,     setBet]     = useState('5')
  const [state,   setState]   = useState<State>('idle')
  const [tries,   setTries]   = useState(0)
  const [hint,    setHint]    = useState<Hint>(null)
  const [showTip, setShowTip] = useState(false)
  const [dayId,   setDayId]   = useState(0)
  const [block,   setBlock]   = useState(0)
  const [pidx,    setPidx]    = useState(0)
  const [streak,  setStreak]  = useState(0)
  const [txid,    setTxid]    = useState<string | null>(null)

  const puzzle = PUZZLES[pidx]
  const short  = (a: string) => `${a.slice(0,6)}...${a.slice(-4)}`

  const fetchBlock = useCallback(async () => {
    try {
      const d  = await fetch('https://api.mainnet.hiro.so/v2/info').then(r => r.json())
      const bh = d.stacks_tip_height
      setBlock(bh)
      const day = Math.floor(bh / 144)
      setDayId(day)
      setPidx(day % PUZZLES.length)
    } catch {}
  }, [])

  useEffect(() => { fetchBlock() }, [fetchBlock])

  const handleGuess = async () => {
    if (!guess || parseFloat(guess.replace(',', '.')) <= 0) return
    if (!isConnected) { connect(); return }

    setState('submitting')

    try {
      await submitGuess(
        Math.round(parseFloat(guess)), // guess uint
        parseInt(bet),                 // bet en tokens entiers
        1,                             // TOKEN-B2S
        (txid) => {
          // Wallet a signe — transaction broadcastee
          setTxid(txid)
          setTries(t => t + 1)
          setGuess('')
          // On passe en 'playing' — l'UI affiche "en attente de confirmation"
          // Le vrai won/lost sera determine par le contrat on-chain
          setState('playing')
        },
        () => {
          // Utilisateur a annule dans le wallet
          setState(tries === 0 ? 'idle' : 'playing')
        },
      )
    } catch (e: any) {
      console.error('[handleGuess]', e?.message || e)
      setState(tries === 0 ? 'idle' : 'playing')
    }
  }

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-black flex flex-col" style={MONO}>

      {/* HEADER */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 20px' }}>
        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">
            <Logo />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>
                STACKS<span style={{ opacity: 0.3 }}>_</span>QUEST
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.3em' }}>
                MAINNET
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.35)', display: 'inline-block', animation: 'pulse 2s infinite' }}/>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em' }}>
                BLOCK_{block || '...'}
              </span>
            </div>

            {streak > 0 && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em' }}>
                STREAK_{streak}
              </span>
            )}

            <button
              onClick={isConnected ? disconnect : connect}
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                fontFamily: 'inherit',
                background: isConnected ? 'rgba(255,68,68,0.08)' : 'rgba(255,255,255,0.06)',
                border:     isConnected ? '1px solid rgba(255,68,68,0.25)' : '1px solid rgba(255,255,255,0.12)',
                color:      isConnected ? '#ff6666' : 'rgba(255,255,255,0.55)',
              }}>
              {isConnected ? `◼ ${short(address!)}` : '▶ CONNECT_WALLET'}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">

        <div className="mb-6">
          <div style={{
            fontSize: 10, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.07)', padding: '4px 14px', borderRadius: 4,
          }}>
            DAY_{dayId} // {puzzle.label}
          </div>
        </div>

        {/* Game card */}
        <div style={{
          width: '100%', maxWidth: 480,
          border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
          padding: 28, background: 'rgba(255,255,255,0.015)',
        }}>

          <div className="flex justify-between mb-5">
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em' }}>
              {puzzle.label}
            </span>
            <span style={{
              fontSize: 9, letterSpacing: '0.2em',
              color: tries === 0 ? 'rgba(255,255,255,0.2)' : tries === 1 ? '#ffd700' : '#ff6666',
            }}>
              TRIES_{tries}/3
            </span>
          </div>

          <p style={{ fontSize: 17, color: 'white', lineHeight: 1.6, marginBottom: 8 }}>
            {puzzle.hint}
          </p>

          <button
            onClick={() => setShowTip(v => !v)}
            style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.15em',
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              marginBottom: 20, padding: 0 }}>
            {showTip ? '▼ HIDE_TIP' : '▶ SHOW_TIP'}
          </button>

          {showTip && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em',
              background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: 6,
              marginBottom: 16 }}>
              Check: {puzzle.tip}
            </div>
          )}

          {/* Feedback hint */}
          {hint && state === 'playing' && (
            <div style={{
              marginBottom: 14, padding: '10px', borderRadius: 8, textAlign: 'center',
              background: hint === 'hot' ? 'rgba(255,68,68,0.07)' : hint === 'warm' ? 'rgba(255,165,0,0.07)' : 'rgba(0,150,255,0.07)',
              border: `1px solid ${hint === 'hot' ? 'rgba(255,68,68,0.2)' : hint === 'warm' ? 'rgba(255,165,0,0.2)' : 'rgba(0,150,255,0.2)'}`,
            }}>
              <span style={{ fontSize: 11, letterSpacing: '0.2em',
                color: hint === 'hot' ? '#ff6666' : hint === 'warm' ? '#ffaa00' : '#4499ff' }}>
                {hint === 'hot' ? 'HOT — TRY AGAIN' : hint === 'warm' ? 'GETTING WARMER' : 'COLD — TRY AGAIN'}
              </span>
            </div>
          )}

          {/* Transaction broadcasted */}
          {txid && state === 'playing' && (
            <div style={{ marginBottom: 14, padding: '10px', borderRadius: 8,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em', margin: 0 }}>
                TX_BROADCASTED —{' '}
                <a href={`https://explorer.hiro.so/txid/${txid}?chain=mainnet`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>
                  VIEW_ON_EXPLORER
                </a>
              </p>
            </div>
          )}

          {/* WON */}
          {state === 'won' && (
            <div style={{ marginBottom: 14, padding: '24px', borderRadius: 10, textAlign: 'center',
              background: 'rgba(0,255,100,0.04)', border: '1px solid rgba(0,255,100,0.15)' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>◈</div>
              <p style={{ fontSize: 12, color: '#00ff64', letterSpacing: '0.25em', marginBottom: 4 }}>CORRECT_ANSWER</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em', marginBottom: 16 }}>
                +{bet} $B2S + POOL_SHARE EARNED
              </p>
              <div className="flex justify-center gap-2 flex-wrap">
                <a href={`https://warpcast.com/~/compose?text=${encodeURIComponent(`Day #${dayId} Stacks Quest solved!\n${puzzle.label} streak: ${streak}\n\nstacks-quest.vercel.app\n#StacksQuest #B2S`)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 9, padding: '6px 12px', borderRadius: 6, letterSpacing: '0.15em',
                    background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)',
                    color: '#a78bfa', textDecoration: 'none', fontFamily: 'inherit' }}>
                  WARPCAST
                </a>
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Day #${dayId} Stacks Quest solved! Streak: ${streak}\n\nstacks-quest.vercel.app\n#StacksQuest #B2S #Stacks`)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 9, padding: '6px 12px', borderRadius: 6, letterSpacing: '0.15em',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontFamily: 'inherit' }}>
                  TWITTER
                </a>
              </div>
            </div>
          )}

          {/* LOST */}
          {state === 'lost' && (
            <div style={{ marginBottom: 14, padding: '20px', borderRadius: 10, textAlign: 'center',
              background: 'rgba(255,68,68,0.04)', border: '1px solid rgba(255,68,68,0.15)' }}>
              <p style={{ fontSize: 12, color: '#ff6666', letterSpacing: '0.25em', marginBottom: 4 }}>GAME_OVER</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em' }}>
                STREAK_RESET — NEW_PUZZLE IN ~24H
              </p>
            </div>
          )}

          {/* NOT CONNECTED */}
          {!isConnected && (state === 'idle' || state === 'playing') && (
            <div>
              <button onClick={connect} style={{
                width: '100%', padding: 14, borderRadius: 10,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.3em',
                fontFamily: 'inherit', cursor: 'pointer',
                background: 'white', border: 'none', color: 'black',
              }}>
                CONNECT_WALLET_TO_PLAY
              </button>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'center',
                letterSpacing: '0.15em', marginTop: 8 }}>
                LEATHER OR XVERSE
              </p>
            </div>
          )}

          {/* SUBMITTING */}
          {state === 'submitting' && (
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.25em', margin: 0 }}>
                WAITING_FOR_WALLET...
              </p>
            </div>
          )}

          {/* GAME INPUT */}
          {isConnected && (state === 'idle' || state === 'playing') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.3em', marginBottom: 6 }}>
                  YOUR_GUESS ({puzzle.unit})
                </p>
                <input
                  type="number" value={guess}
                  onChange={e => setGuess(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGuess()}
                  placeholder="0"
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 8, boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: 'white', fontSize: 22, fontWeight: 700, fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>

              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.3em', marginBottom: 6 }}>
                  BET_AMOUNT ($B2S)
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['1', '5', '10', '25'].map(v => (
                    <button key={v} onClick={() => setBet(v)}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 6, fontSize: 12,
                        fontFamily: 'inherit', letterSpacing: '0.1em', cursor: 'pointer',
                        background: bet === v ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)',
                        border:     bet === v ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.06)',
                        color:      bet === v ? 'white' : 'rgba(255,255,255,0.3)',
                      }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleGuess}
                disabled={!guess || parseFloat(guess.replace(',', '.')) <= 0}
                style={{
                  width: '100%', padding: 14, borderRadius: 10,
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.3em', fontFamily: 'inherit',
                  cursor: guess ? 'pointer' : 'not-allowed', border: 'none', transition: 'all 0.15s',
                  background: guess ? 'white' : 'rgba(255,255,255,0.06)',
                  color:      guess ? 'black' : 'rgba(255,255,255,0.2)',
                }}>
                {tries === 0 ? `SUBMIT_GUESS + BET_${bet}_$B2S` : `RETRY (${3 - tries} LEFT)`}
              </button>
            </div>
          )}

          {/* DONE */}
          {(state === 'won' || state === 'lost') && (
            <button
              onClick={() => { setState('idle'); setTries(0); setGuess(''); setHint(null); setTxid(null) }}
              style={{
                width: '100%', padding: 12, borderRadius: 10, marginTop: 8,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.25em', fontFamily: 'inherit',
                cursor: 'pointer', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.3)',
              }}>
              BACK
            </button>
          )}
        </div>

        {/* How it works */}
        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, maxWidth: 480, width: '100%' }}>
          {[
            { n: '01', t: 'GUESS', d: 'Predict real Stacks on-chain data. 3 tries per day.' },
            { n: '02', t: 'BET',   d: 'Wager $B2S tokens. Winners share the daily pool.' },
            { n: '03', t: 'EARN',  d: 'Get $B2S + rare NFT badges for streaks.' },
          ].map(s => (
            <div key={s.n} style={{ padding: 16, borderRadius: 10, textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.01)' }}>
              <p style={{ fontSize: 26, fontWeight: 700, color: 'white', margin: '0 0 6px' }}>{s.n}</p>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: 'white', margin: '0 0 4px' }}>{s.t}</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', lineHeight: 1.5, margin: 0 }}>{s.d}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20 }}>
          <a href="https://base2stacks-tracker.vercel.app" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)', textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.06)', padding: '6px 14px', borderRadius: 6 }}>
            BASE2STACKS_TRACKER
          </a>
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '14px 20px' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.2em' }}>
            STACKS_QUEST // WKALIDEV // #STACKSBUILDERREWARDS
          </span>
          <div className="flex gap-4">
            {[
              { l: 'GITHUB',   h: 'https://github.com/wkalidev/stacks-quest' },
              { l: 'WARPCAST', h: 'https://warpcast.com/willywarrior' },
              { l: 'EXPLORER', h: 'https://explorer.hiro.so/address/SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N?chain=mainnet' },
            ].map(x => (
              <a key={x.l} href={x.h} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', textDecoration: 'none', letterSpacing: '0.15em' }}>
                {x.l}
              </a>
            ))}
          </div>
        </div>
      </footer>

    </div>
  )
}