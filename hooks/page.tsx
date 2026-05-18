'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '../hooks/useWallet'
import { useQuest }  from '../hooks/useQuest'

const MONO = { fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace" }

const PUZZLE_TYPES = [
  { id: 'block-height', label: 'BLOCK_HEIGHT',   hint: 'What is the current Stacks block height?',     unit: 'blocks', hint2: 'Check explorer.hiro.so' },
  { id: 'stakers',      label: 'TOTAL_STAKERS',  hint: 'How many wallets are staking $B2S right now?',  unit: 'wallets', hint2: 'Check the staking vault' },
  { id: 'tx-count',     label: 'TX_COUNT_24H',   hint: 'How many Stacks transactions in the last 24h?', unit: 'txs', hint2: 'Check Hiro API stats' },
  { id: 'stx-price',    label: 'STX_PRICE_CENTS', hint: 'What is the STX price in cents right now?',   unit: 'cents', hint2: 'CoinGecko / Binance' },
]

function HexLogo() {
  return (
    <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
      <polygon points="24,4 42,14 42,34 24,44 6,34 6,14" stroke="white" strokeWidth="1.5" fill="none"/>
      <text x="24" y="30" textAnchor="middle" style={{ fontFamily:'monospace', fontSize:'22px', fontWeight:700, fill:'white' }}>Q</text>
      <line x1="30" y1="32" x2="36" y2="38" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

type GameState = 'idle' | 'playing' | 'submitted' | 'won' | 'lost' | 'already-played'

export default function Home() {
  const { mounted, isConnected, address, connect, disconnect } = useWallet()
  const { play, claimReward, hasPlayedToday, loading, error, txId } = useQuest()

  const [guess,     setGuess]     = useState('')
  const [bet,       setBet]       = useState('5')
  const [gameState, setGameState] = useState<GameState>('idle')
  const [tries,     setTries]     = useState(0)
  const [dayId,     setDayId]     = useState(0)
  const [blockHeight, setBlockHeight] = useState(0)
  const [puzzleIdx, setPuzzleIdx] = useState(0)
  const [streak,    setStreak]    = useState(0)
  const [feedback,  setFeedback]  = useState<'hot'|'warm'|'cold'|null>(null)
  const [showHint,  setShowHint]  = useState(false)

  const puzzle = PUZZLE_TYPES[puzzleIdx]

  // Fetch current block and check if played
  const fetchState = useCallback(async () => {
    try {
      const res  = await fetch('https://api.mainnet.hiro.so/v2/info')
      const data = await res.json()
      const bh   = data.stacks_tip_height
      const day  = Math.floor(bh / 144)
      setBlockHeight(bh)
      setDayId(day)
      setPuzzleIdx(day % PUZZLE_TYPES.length)

      if (isConnected && address) {
        const played = await hasPlayedToday(address)
        if (played) setGameState('already-played')
      }
    } catch (e) { console.error(e) }
  }, [isConnected, address, hasPlayedToday])

  useEffect(() => { if (mounted) fetchState() }, [mounted, fetchState])

  // Watch txId to update state
  useEffect(() => {
    if (txId) setGameState('submitted')
  }, [txId])

  const handlePlay = async () => {
    if (!guess || parseInt(guess) <= 0 || !isConnected) return
    const newTries = tries + 1
    setTries(newTries)

    await play(parseInt(guess), parseFloat(bet))
    setGuess('')

    // Simulated feedback for UX before tx confirms
    if (newTries < 3 && gameState !== 'submitted') {
      const diff = Math.random()
      setFeedback(diff < 0.3 ? 'hot' : diff < 0.6 ? 'warm' : 'cold')
      setGameState('playing')
    } else if (newTries >= 3) {
      setGameState('lost')
    }
  }

  const short = (a: string) => `${a.slice(0,6)}...${a.slice(-4)}`

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-black flex flex-col" style={MONO}>

      {/* HEADER */}
      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '12px 24px' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HexLogo />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>
                STACKS<span style={{ opacity: 0.3 }}>_</span>QUEST
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.3em' }}>MAINNET</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Live block */}
            <div className="hidden sm:flex items-center gap-2">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.4)', display:'inline-block' }}/>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>
                BLOCK_{blockHeight}
              </span>
            </div>

            {/* Streak */}
            {streak > 0 && (
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
                🔥 STREAK_{streak}
              </div>
            )}

            {/* Wallet */}
            <button onClick={isConnected ? disconnect : connect}
              style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                fontFamily: 'inherit',
                background: isConnected ? 'rgba(255,68,68,0.08)' : 'rgba(255,255,255,0.06)',
                border: isConnected ? '1px solid rgba(255,68,68,0.25)' : '1px solid rgba(255,255,255,0.1)',
                color: isConnected ? '#ff6666' : 'rgba(255,255,255,0.5)',
              }}>
              {isConnected ? `◼ ${short(address!)}` : '▶ CONNECT_WALLET'}
            </button>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">

        {/* Day badge */}
        <div className="mb-6 flex items-center gap-3">
          <div style={{
            fontSize: 10, letterSpacing: '0.25em', color: 'rgba(255,255,255,0.25)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '4px 14px', borderRadius: 4,
          }}>
            DAY_{dayId} // {puzzle.label}
          </div>
        </div>

        {/* GAME CARD */}
        <div style={{
          width: '100%', maxWidth: 480,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '28px',
          background: 'rgba(255,255,255,0.015)',
        }}>

          {/* Puzzle header */}
          <div className="flex items-center justify-between mb-5">
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

          {/* Question */}
          <p style={{ fontSize: 17, color: 'white', lineHeight: 1.6, marginBottom: 6 }}>
            {puzzle.hint}
          </p>

          {/* Hint toggle */}
          <button onClick={() => setShowHint(h => !h)}
            style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em',
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              marginBottom: '1.5rem', padding: 0 }}>
            {showHint ? '▼ HIDE_HINT' : '▶ SHOW_HINT'}
          </button>
          {showHint && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: '1.5rem',
              letterSpacing: '0.1em', background: 'rgba(255,255,255,0.03)',
              padding: '8px 12px', borderRadius: 6 }}>
              💡 {puzzle.hint2}
            </p>
          )}

          {/* FEEDBACK */}
          {feedback && gameState === 'playing' && (
            <div className="mb-4 py-3 text-center rounded-lg" style={{
              background: feedback === 'hot' ? 'rgba(255,68,68,0.08)' : feedback === 'warm' ? 'rgba(255,165,0,0.08)' : 'rgba(0,150,255,0.08)',
              border: `1px solid ${feedback === 'hot' ? 'rgba(255,68,68,0.25)' : feedback === 'warm' ? 'rgba(255,165,0,0.25)' : 'rgba(0,150,255,0.25)'}`,
            }}>
              <span style={{ fontSize: 11, letterSpacing: '0.2em',
                color: feedback === 'hot' ? '#ff6666' : feedback === 'warm' ? '#ffaa00' : '#4499ff' }}>
                {feedback === 'hot' ? '🔥 YOU ARE HOT — TRY AGAIN' :
                 feedback === 'warm' ? '🌡 GETTING_WARMER' : '🧊 TOO FAR — TRY AGAIN'}
              </span>
            </div>
          )}

          {/* TX SUBMITTED */}
          {gameState === 'submitted' && (
            <div className="mb-4 py-4 text-center rounded-lg" style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.2em', marginBottom: 6 }}>
                TX_SUBMITTED
              </p>
              <a href={`https://explorer.hiro.so/txid/${txId}?chain=mainnet`}
                target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>
                VIEW_ON_EXPLORER →
              </a>
            </div>
          )}

          {/* WON */}
          {gameState === 'won' && (
            <div className="mb-4 py-6 text-center rounded-lg" style={{
              background: 'rgba(0,255,100,0.04)',
              border: '1px solid rgba(0,255,100,0.15)',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>◈</div>
              <p style={{ fontSize: 12, color: '#00ff64', letterSpacing: '0.25em', marginBottom: 4 }}>
                CORRECT_ANSWER
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em', marginBottom: 16 }}>
                +{bet} $B2S + POOL_SHARE CLAIMABLE
              </p>
              <button onClick={() => claimReward(dayId)}
                disabled={loading}
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.25em',
                  padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: 'rgba(0,255,100,0.1)',
                  border: '1px solid rgba(0,255,100,0.3)',
                  color: '#00ff64', marginBottom: 12,
                }}>
                {loading ? 'CLAIMING...' : 'CLAIM_REWARD'}
              </button>
              <div className="flex justify-center gap-2">
                <a href={`https://warpcast.com/~/compose?text=${encodeURIComponent(`🎯 Day #${dayId} Stacks Quest solved!\nPuzzle: ${puzzle.label}\nStreak: ${streak + 1} days 🔥\n\nPlay at stacks-quest.vercel.app\n#StacksQuest #B2S #Stacks`)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    fontSize: 9, padding: '6px 12px', borderRadius: 6,
                    letterSpacing: '0.15em', fontFamily: 'inherit',
                    background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)',
                    color: '#a78bfa', textDecoration: 'none',
                  }}>
                  🟣 SHARE_ON_FARCASTER
                </a>
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`🎯 Day #${dayId} Stacks Quest solved!\nPuzzle: ${puzzle.label}\n\nPlay at stacks-quest.vercel.app\n#StacksQuest #B2S #Stacks`)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    fontSize: 9, padding: '6px 12px', borderRadius: 6,
                    letterSpacing: '0.15em', fontFamily: 'inherit',
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.4)', textDecoration: 'none',
                  }}>
                  𝕏 SHARE_ON_X
                </a>
              </div>
            </div>
          )}

          {/* LOST */}
          {gameState === 'lost' && (
            <div className="mb-4 py-5 text-center rounded-lg" style={{
              background: 'rgba(255,68,68,0.04)',
              border: '1px solid rgba(255,68,68,0.15)',
            }}>
              <p style={{ fontSize: 12, color: '#ff6666', letterSpacing: '0.25em', marginBottom: 4 }}>
                GAME_OVER
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.15em' }}>
                STREAK_RESET — NEW_PUZZLE_IN ~24H
              </p>
            </div>
          )}

          {/* ALREADY PLAYED */}
          {gameState === 'already-played' && (
            <div className="mb-4 py-5 text-center rounded-lg" style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.25em', marginBottom: 4 }}>
                ALREADY_PLAYED_TODAY
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.15em' }}>
                COME_BACK_TOMORROW FOR_NEXT_PUZZLE
              </p>
            </div>
          )}

          {/* NOT CONNECTED */}
          {!isConnected && (gameState === 'idle' || gameState === 'playing') && (
            <div className="mb-4">
              <button onClick={connect}
                style={{
                  width: '100%', padding: '14px', borderRadius: 10,
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.3em',
                  fontFamily: 'inherit', cursor: 'pointer',
                  background: 'white', border: 'none', color: 'black',
                }}>
                ▶ CONNECT_WALLET_TO_PLAY
              </button>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', textAlign: 'center',
                letterSpacing: '0.15em', marginTop: 8 }}>
                LEATHER OR XVERSE
              </p>
            </div>
          )}

          {/* GAME INPUT */}
          {isConnected && (gameState === 'idle' || gameState === 'playing') && (
            <div className="space-y-3">
              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.3em', marginBottom: 6 }}>
                  YOUR_GUESS ({puzzle.unit})
                </p>
                <input
                  type="number"
                  value={guess}
                  onChange={e => setGuess(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePlay()}
                  placeholder="0"
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'white', fontSize: 22, fontWeight: 700,
                    fontFamily: 'inherit', outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.3em', marginBottom: 6 }}>
                  BET_AMOUNT ($B2S · MIN 1)
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['1', '5', '10', '25'].map(v => (
                    <button key={v} onClick={() => setBet(v)}
                      style={{
                        flex: 1, padding: '9px 0', borderRadius: 6, fontSize: 12,
                        fontFamily: 'inherit', letterSpacing: '0.1em', cursor: 'pointer',
                        background: bet === v ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)',
                        border: bet === v ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(255,255,255,0.06)',
                        color: bet === v ? 'white' : 'rgba(255,255,255,0.3)',
                      }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handlePlay}
                disabled={!guess || loading}
                style={{
                  width: '100%', padding: '14px', borderRadius: 10,
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.3em',
                  fontFamily: 'inherit',
                  cursor: guess && !loading ? 'pointer' : 'not-allowed',
                  background: guess && !loading ? 'white' : 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: guess && !loading ? 'black' : 'rgba(255,255,255,0.2)',
                  transition: 'all 0.15s',
                }}>
                {loading ? '⏳ BROADCASTING...' :
                 tries === 0 ? `SUBMIT_GUESS + BET_${bet}_$B2S` :
                 `RETRY (${3 - tries} LEFT)`}
              </button>

              {error && (
                <p style={{ fontSize: 9, color: '#ff6666', letterSpacing: '0.15em', textAlign: 'center' }}>
                  ERROR: {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* HOW IT WORKS */}
        <div className="mt-10 grid grid-cols-3 gap-3" style={{ maxWidth: 480, width: '100%' }}>
          {[
            { n: '01', title: 'GUESS',  desc: 'Predict real Stacks on-chain data. 3 tries per day.' },
            { n: '02', title: 'BET',    desc: 'Wager $B2S tokens. Winners share the daily pool.' },
            { n: '03', title: 'EARN',   desc: 'Get $B2S + rare NFT badges for streaks.' },
          ].map(s => (
            <div key={s.n} style={{
              padding: '16px', borderRadius: 10, textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.01)',
            }}>
              <p style={{ fontSize: 26, fontWeight: 700, color: 'white', margin: '0 0 6px' }}>{s.n}</p>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', color: 'white', margin: '0 0 4px' }}>{s.title}</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', lineHeight: 1.5, margin: 0 }}>{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Link to tracker */}
        <div className="mt-6">
          <a href="https://base2stacks-tracker.vercel.app" target="_blank" rel="noopener noreferrer"
            style={{
              fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)',
              textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.06)',
              padding: '6px 14px', borderRadius: 6,
            }}>
            ← BASE2STACKS_TRACKER
          </a>
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 24px' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.2em' }}>
            STACKS_QUEST // WKALIDEV(ZCODEBASE) // #STACKSBUILDERREWARDS
          </span>
          <div className="flex gap-4">
            {[
              { l: 'GITHUB',   h: 'https://github.com/wkalidev/stacks-quest' },
              { l: 'WARPCAST', h: 'https://warpcast.com/willywarrior' },
              { l: 'EXPLORER', h: `https://explorer.hiro.so/address/SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N?chain=mainnet` },
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