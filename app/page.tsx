'use client'

import { useState, useEffect } from 'react'

const MONO = { fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace" }

const PUZZLE_TYPES = [
  { id: 'block-height', label: 'BLOCK_HEIGHT',  hint: 'What is the current Stacks block height?',    unit: 'blocks' },
  { id: 'stakers',      label: 'TOTAL_STAKERS',  hint: 'How many wallets are staking $B2S right now?', unit: 'wallets' },
  { id: 'tx-count',     label: 'TX_COUNT_24H',   hint: 'How many Stacks transactions in the last 24h?', unit: 'txs' },
  { id: 'stx-price',    label: 'STX_PRICE_CENTS', hint: 'What is the STX price in cents right now?',   unit: 'cents' },
]

function HexIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <polygon points="24,4 42,14 42,34 24,44 6,34 6,14"
        stroke="white" strokeWidth="1.5" fill="none"/>
      <text x="24" y="30" textAnchor="middle"
        style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 700, fill: 'white' }}>Q</text>
      <line x1="30" y1="32" x2="36" y2="38" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  )
}

function LiveIndicator() {
  const [block, setBlock] = useState<number | null>(null)
  useEffect(() => {
    fetch('https://api.mainnet.hiro.so/v2/info')
      .then(r => r.json())
      .then(d => setBlock(d.stacks_tip_height))
      .catch(() => {})
  }, [])
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" style={{ opacity: 0.6 }}/>
      <span style={{ ...MONO, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em' }}>
        {block ? `BLOCK_${block}` : 'CONNECTING...'}
      </span>
    </div>
  )
}

function CountdownTimer({ endBlock, currentBlock }: { endBlock: number; currentBlock: number }) {
  const blocksLeft = Math.max(0, endBlock - currentBlock)
  const secondsLeft = blocksLeft * 10 * 60
  const h = Math.floor(secondsLeft / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  return (
    <div className="text-center">
      <p style={{ ...MONO, fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em' }}>
        NEXT_PUZZLE_IN
      </p>
      <p style={{ ...MONO, fontSize: 28, fontWeight: 700, color: 'white' }}>
        {String(h).padStart(2,'0')}:{String(m).padStart(2,'0')}
      </p>
    </div>
  )
}

type GameState = 'idle' | 'playing' | 'won' | 'lost'

export default function Home() {
  const [guess, setGuess]         = useState('')
  const [bet, setBet]             = useState('5')
  const [gameState, setGameState] = useState<GameState>('idle')
  const [tries, setTries]         = useState(0)
  const [feedback, setFeedback]   = useState<'hot' | 'warm' | 'cold' | null>(null)
  const [dayId, setDayId]         = useState(0)
  const [puzzleIdx, setPuzzleIdx] = useState(0)
  const [streakCount, setStreakCount] = useState(0)

  const puzzle = PUZZLE_TYPES[puzzleIdx]

  useEffect(() => {
    fetch('https://api.mainnet.hiro.so/v2/info')
      .then(r => r.json())
      .then(d => {
        const day = Math.floor(d.stacks_tip_height / 144)
        setDayId(day)
        setPuzzleIdx(day % PUZZLE_TYPES.length)
      })
      .catch(() => {})
  }, [])

  const handleGuess = () => {
    if (!guess || parseInt(guess) <= 0) return
    const newTries = tries + 1
    setTries(newTries)

    // Simulate feedback (real implementation calls contract)
    const diff = Math.random()
    if (diff < 0.15) {
      setGameState('won')
      setStreakCount(s => s + 1)
      setFeedback(null)
    } else if (newTries >= 3) {
      setGameState('lost')
      setStreakCount(0)
      setFeedback(null)
    } else {
      setFeedback(diff < 0.35 ? 'hot' : diff < 0.6 ? 'warm' : 'cold')
    }
    setGuess('')
  }

  const reset = () => {
    setGameState('idle')
    setTries(0)
    setGuess('')
    setFeedback(null)
  }

  return (
    <div className="min-h-screen bg-black flex flex-col" style={MONO}>

      {/* Header */}
      <header className="border-b flex items-center justify-between px-6 py-4"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <HexIcon />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'white', letterSpacing: '-0.5px' }}>
              STACKS<span style={{ opacity: 0.4 }}>_</span>QUEST
            </div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.3em' }}>
              MAINNET
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <LiveIndicator />
          {streakCount > 0 && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em' }}>
              STREAK_{streakCount}
            </div>
          )}
          <button
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.2em',
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
            }}>
            CONNECT_WALLET
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">

        {/* Day badge */}
        <div className="mb-8 flex items-center gap-3">
          <div style={{
            fontSize: 10, letterSpacing: '0.3em', color: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '4px 12px', borderRadius: 4,
          }}>
            DAY_{dayId} // PUZZLE_{puzzleIdx + 1}_OF_4
          </div>
        </div>

        {/* Puzzle card */}
        <div style={{
          width: '100%', maxWidth: 480,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '2rem',
          background: 'rgba(255,255,255,0.02)',
        }}>
          {/* Puzzle type */}
          <div className="flex items-center justify-between mb-6">
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.3em' }}>
              {puzzle.label}
            </div>
            <div style={{
              fontSize: 9, letterSpacing: '0.2em',
              color: tries === 0 ? 'rgba(255,255,255,0.3)' : tries === 1 ? '#ffd700' : '#ff4444',
            }}>
              TRIES_{tries}/3
            </div>
          </div>

          {/* Question */}
          <p style={{ fontSize: 16, color: 'white', marginBottom: '2rem', lineHeight: 1.6 }}>
            {puzzle.hint}
          </p>

          {/* Feedback */}
          {feedback && (
            <div className="mb-4 text-center py-3 rounded-lg" style={{
              background: feedback === 'hot'  ? 'rgba(255,68,68,0.1)' :
                          feedback === 'warm' ? 'rgba(255,165,0,0.1)' :
                                               'rgba(0,150,255,0.1)',
              border: `1px solid ${feedback === 'hot' ? 'rgba(255,68,68,0.3)' : feedback === 'warm' ? 'rgba(255,165,0,0.3)' : 'rgba(0,150,255,0.3)'}`,
            }}>
              <span style={{
                fontSize: 11, letterSpacing: '0.2em',
                color: feedback === 'hot' ? '#ff4444' : feedback === 'warm' ? '#ffa500' : '#0096ff',
              }}>
                {feedback === 'hot'  ? '// TOO_CLOSE — YOU ARE HOT' :
                 feedback === 'warm' ? '// GETTING_WARMER' :
                                      '// TOO_FAR — YOU ARE COLD'}
              </span>
            </div>
          )}

          {/* Won state */}
          {gameState === 'won' && (
            <div className="mb-4 text-center py-6 rounded-lg" style={{
              background: 'rgba(0,255,100,0.05)',
              border: '1px solid rgba(0,255,100,0.2)',
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>◈</div>
              <p style={{ fontSize: 12, color: '#00ff64', letterSpacing: '0.2em', marginBottom: 4 }}>
                CORRECT_ANSWER
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em' }}>
                +{bet} $B2S + POOL_SHARE EARNED
              </p>
              <div className="mt-4 flex gap-2 justify-center">
                <a href={`https://warpcast.com/~/compose?text=${encodeURIComponent(`🎯 I solved today's Stacks Quest puzzle!\nDay #${dayId} — ${puzzle.label}\n\nPlay at stacks-quest.vercel.app\n#StacksQuest #B2S #Stacks`)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    fontSize: 9, padding: '6px 12px', borderRadius: 6, letterSpacing: '0.2em',
                    background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)',
                    color: '#a78bfa', textDecoration: 'none',
                  }}>
                  SHARE_ON_FARCASTER
                </a>
              </div>
            </div>
          )}

          {/* Lost state */}
          {gameState === 'lost' && (
            <div className="mb-4 text-center py-6 rounded-lg" style={{
              background: 'rgba(255,68,68,0.05)',
              border: '1px solid rgba(255,68,68,0.2)',
            }}>
              <p style={{ fontSize: 12, color: '#ff4444', letterSpacing: '0.2em', marginBottom: 4 }}>
                GAME_OVER
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em' }}>
                BETTER_LUCK_TOMORROW
              </p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', marginTop: 8, letterSpacing: '0.1em' }}>
                STREAK_RESET — COME_BACK_IN ~24H
              </p>
            </div>
          )}

          {/* Input area */}
          {gameState === 'idle' || gameState === 'playing' ? (
            <div className="space-y-3">
              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.3em', marginBottom: 6 }}>
                  YOUR_GUESS ({puzzle.unit})
                </p>
                <input
                  type="number"
                  value={guess}
                  onChange={e => setGuess(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleGuess()}
                  placeholder="0"
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'white', fontSize: 20, fontWeight: 700,
                    fontFamily: 'inherit', outline: 'none',
                  }}
                />
              </div>
              <div>
                <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.3em', marginBottom: 6 }}>
                  BET_AMOUNT ($B2S)
                </p>
                <div className="flex gap-2">
                  {['5', '10', '25', '50'].map(v => (
                    <button key={v} onClick={() => setBet(v)}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: 6, fontSize: 11,
                        fontFamily: 'inherit', letterSpacing: '0.1em', cursor: 'pointer',
                        background: bet === v ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
                        border: bet === v ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.06)',
                        color: bet === v ? 'white' : 'rgba(255,255,255,0.3)',
                      }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleGuess}
                disabled={!guess}
                style={{
                  width: '100%', padding: '14px', borderRadius: 10,
                  fontSize: 11, fontWeight: 700, letterSpacing: '0.3em',
                  fontFamily: 'inherit', cursor: guess ? 'pointer' : 'not-allowed',
                  background: guess ? 'white' : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: guess ? 'black' : 'rgba(255,255,255,0.2)',
                  transition: 'all 0.15s',
                }}>
                {tries === 0 ? 'SUBMIT_GUESS' : `RETRY (${3 - tries} LEFT)`}
              </button>
            </div>
          ) : (
            <button onClick={reset}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.3em',
                fontFamily: 'inherit', cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.4)',
              }}>
              PLAY_AGAIN_TOMORROW
            </button>
          )}
        </div>

        {/* How it works */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ maxWidth: 480, width: '100%' }}>
          {[
            { n: '01', title: 'GUESS',  desc: 'Predict real Stacks on-chain data. 3 tries.' },
            { n: '02', title: 'BET',    desc: 'Wager $B2S tokens. Winners split the pool.' },
            { n: '03', title: 'EARN',   desc: 'Collect $B2S + NFT badge rewards on-chain.' },
          ].map(s => (
            <div key={s.n} style={{
              padding: '1rem', borderRadius: 10, textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.01)',
            }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: 'white', marginBottom: 6 }}>{s.n}</p>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', color: 'white', marginBottom: 4 }}>
                {s.title}
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', lineHeight: 1.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '1.5rem 1.5rem' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.2em' }}>
            STACKS_QUEST // BUILT_BY{' '}
            <a href="https://github.com/wkalidev" target="_blank" rel="noopener noreferrer"
              style={{ color: 'rgba(255,255,255,0.4)' }}>WKALIDEV</a>
          </div>
          <div className="flex items-center gap-4">
            {[
              { label: 'TRACKER', href: 'https://base2stacks-tracker.vercel.app' },
              { label: 'GITHUB',  href: 'https://stacks-quest-ten.vercel.app/' },
              { label: 'WARPCAST', href: 'https://warpcast.com/willywarrior' },
            ].map(l => (
              <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)',
                  textDecoration: 'none' }}>
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}