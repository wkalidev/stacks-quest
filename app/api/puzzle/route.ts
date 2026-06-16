import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const chain    = req.nextUrl.searchParams.get('chain') || 'stacks'
  const puzzleId = Math.floor(Date.now() / 86400000)

  try {
    if (chain === 'stacks') {
      const res  = await fetch('https://api.mainnet.hiro.so/v2/info', { next: { revalidate: 30 } })
      const info = await res.json() as { stacks_tip_height: number }
      const h    = info.stacks_tip_height
      return NextResponse.json({
        id:           puzzleId,
        question:     `What is the current Stacks block height? (hint: it's around ${Math.floor(h / 1000) * 1000})`,
        hint:         'Check explorer.hiro.so — updates every ~10 minutes.',
        type:         'stacks-block-height',
        answer:       h,
        deadline:     Math.floor(Date.now() / 1000) + 86400,
        finalized:    false,
        totalPlayers: 0,
        prizePool:    '0',
      })
    }

    if (chain === 'base') {
      const res  = await fetch('https://mainnet.base.org', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        next:    { revalidate: 30 },
      })
      const data  = await res.json() as { result: string }
      const block = parseInt(data.result, 16)
      const m     = Math.round(block / 1e6)
      return NextResponse.json({
        id:           puzzleId,
        question:     `What is the current Base Network block number, in millions? (hint: around ${m}M)`,
        hint:         'Check basescan.org — Base produces ~2 blocks per second.',
        type:         'base-block-millions',
        answer:       m,
        deadline:     Math.floor(Date.now() / 1000) + 86400,
        finalized:    false,
        totalPlayers: 0,
        prizePool:    '0',
      })
    }

    if (chain === 'celo') {
      const res  = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd', { next: { revalidate: 60 } })
      const data = await res.json() as { celo?: { usd?: number } }
      const cents = Math.round((data.celo?.usd ?? 0) * 100)
      return NextResponse.json({
        id:           puzzleId,
        question:     'What is the current CELO price in whole USD cents? (e.g. enter 45 for $0.45)',
        hint:         'Check CoinGecko or Binance — multiply CELO/USD by 100.',
        type:         'celo-price-cents',
        answer:       cents,
        deadline:     Math.floor(Date.now() / 1000) + 86400,
        finalized:    false,
        totalPlayers: 0,
        prizePool:    '0',
      })
    }

    return NextResponse.json({ error: 'Invalid chain' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch puzzle' }, { status: 500 })
  }
}
