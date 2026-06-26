import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', background: '#080810', color: '#fff', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ maxWidth: 400, width: '100%', padding: '20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#9945ff', marginBottom: 8 }}>Stacks Quest</h1>
        <p style={{ color: '#555', marginBottom: 40 }}>Daily blockchain puzzle + DeFi agent on Stacks</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Link href="/game" style={{
            padding: '16px', borderRadius: 12, background: '#9945ff', color: '#fff',
            textDecoration: 'none', fontWeight: 700, fontSize: 16,
          }}>🎮 Play Daily Puzzle</Link>
          <Link href="/agent" style={{
            padding: '16px', borderRadius: 12, background: 'rgba(153,69,255,0.1)',
            border: '1px solid rgba(153,69,255,0.3)', color: '#9945ff',
            textDecoration: 'none', fontWeight: 700, fontSize: 14,
          }}>⬡ Open DeFi Agent</Link>
        </div>
        <p style={{ color: '#333', fontSize: 11, marginTop: 32 }}>
          STX · sBTC · $B2S · USDCx · Celo · Base coming soon
        </p>
      </div>
    </main>
  )
}
