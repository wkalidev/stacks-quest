'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Home() {
  const [block, setBlock] = useState(0)

  useEffect(() => {
    fetch('/api/hiro?path=/v2/info')
      .then(r => r.json())
      .then(d => setBlock(d?.stacks_tip_height || 0))
      .catch(() => {})
  }, [])

  const puzzleNumber = Math.floor(Date.now() / 86400000)

  return (
    <main style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace", padding: '2rem' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: '#5546ff', marginBottom: 8 }}>Stacks Quest</h1>
        <p style={{ color: '#888', marginBottom: 32, fontSize: 13 }}>Daily blockchain puzzle game + non-custodial DeFi agent on Stacks (Bitcoin L2)</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 32 }}>
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: 16 }}>
            <p style={{ color: '#5546ff', fontSize: 11, margin: '0 0 4px', letterSpacing: '0.15em' }}>DAILY PUZZLE</p>
            <p style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>#{puzzleNumber}</p>
          </div>
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: 8, padding: 16 }}>
            <p style={{ color: '#00ff9f', fontSize: 11, margin: '0 0 4px', letterSpacing: '0.15em' }}>NETWORK</p>
            <p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#00ff9f' }}>
              {block > 0 ? `Block #${block.toLocaleString()}` : 'Stacks Mainnet'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}>
          <Link href="/agent" style={{
            flex: 1, background: '#5546ff', color: '#fff', textAlign: 'center',
            padding: '14px', borderRadius: 8, fontWeight: 700, fontSize: 14,
            textDecoration: 'none', display: 'block', letterSpacing: '0.05em',
          }}>
            Play Now & Open Agent
          </Link>
        </div>

        <div style={{ borderTop: '1px solid #222', paddingTop: 24 }}>
          <h2 style={{ fontSize: 14, color: '#5546ff', marginBottom: 16, letterSpacing: '0.15em' }}>How it works</h2>
          {[
            ['🎮', 'Daily Puzzle',  'Guess real Stacks blockchain data (block height, STX price, tx count)'],
            ['💰', 'Bet & Win',     'Bet 1-100 STX, $B2S, USDCx or sBTC. Winners split the reward pool.'],
            ['🔥', 'Build Streak',  'Check in daily for 0.001 STX. Streak bonuses at 7 / 30 / 100 days.'],
            ['🤖', 'DeFi Agent',   'Swap, bridge, and manage your portfolio via natural language.'],
          ].map(([icon, title, desc]) => (
            <div key={String(title)} style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <div>
                <p style={{ fontWeight: 700, margin: '0 0 2px', fontSize: 14 }}>{title}</p>
                <p style={{ color: '#666', margin: 0, fontSize: 13 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, padding: 16, background: '#111', borderRadius: 8, border: '1px solid #222' }}>
          <p style={{ fontSize: 11, color: '#444', margin: '0 0 4px', letterSpacing: '0.15em' }}>SUPPORTED TOKENS</p>
          <p style={{ margin: 0, color: '#888', fontSize: 13 }}>STX · sBTC · $B2S · USDCx</p>
        </div>

        <footer style={{ marginTop: 40, borderTop: '1px solid #111', paddingTop: 16, fontSize: 12, color: '#444' }}>
          <a href="https://base2stacks-tracker.vercel.app" style={{ color: '#5546ff', textDecoration: 'none' }}>Base2Stacks Bridge</a>
          {' · '}
          <a href="https://github.com/wkalidev/stacks-quest" style={{ color: '#444', textDecoration: 'none' }}>GitHub</a>
          {' · '}Built by zcodebase.eth
        </footer>
      </div>
    </main>
  )
}
