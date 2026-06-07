// Composant SwapCard — quote en temps réel + swap natif via Velar
// Remplace l'ancien ActionCard pour type === 'swap'

import { useState, useEffect } from 'react'

const VELAR_ADDR   = 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1'
const SHARE_FEE_TO = `${VELAR_ADDR}.univ2-share-fee-to`

const TOKEN_COLOR: Record<string, string> = {
  STX: '#9945ff', '$B2S': '#00ff9f', sBTC: '#f7931a',
  aeUSDC: '#2775ca', ALEX: '#00d4ff', WELSH: '#ff6b9d',
  VELAR: '#00ff9f', LEO: '#ffd700', USDA: '#00d4ff',
}

interface SwapQuote {
  status:       string
  dex:          string
  poolId:       number
  tokenIn:      { symbol: string; amount: string; contract: string | null }
  tokenOut:     { symbol: string; amount: string; contract: string | null }
  amountOutMin: string
  priceImpact:  string
  fee:          string
  route:        string
  contracts:    { router: string; token0: string; token1: string; shareFee: string }
}

export function SwapCard({
  action,
  address,
}: {
  action: { tokenIn: string; tokenOut: string; amount: number; dex?: string }
  address: string | null
}) {
  const [quote,    setQuote]    = useState<SwapQuote | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)
  const [swapping, setSwapping] = useState(false)
  const [txid,     setTxid]     = useState<string | null>(null)
  const [slippage, setSlippage] = useState(1) // 1%

  useEffect(() => {
    const fetchQuote = async () => {
      setLoading(true); setError(null)
      try {
        const res  = await fetch(`/api/swap?tokenIn=${action.tokenIn}&tokenOut=${action.tokenOut}&amount=${action.amount}`)
        const data = await res.json()
        if (data.status === 'ok') setQuote(data)
        else setError(data.error || 'No pool found')
      } catch {
        setError('Failed to fetch quote')
      }
      setLoading(false)
    }
    fetchQuote()
  }, [action.tokenIn, action.tokenOut, action.amount])

  const executeSwap = async () => {
    if (!quote || !address || swapping) return
    setSwapping(true)
    try {
      const { openContractCall } = await import('@stacks/connect')
      const stacks = await import('@stacks/transactions')

      const amtIn     = BigInt(Math.round(parseFloat(quote.tokenIn.amount) * 1e6))
      const amtOutMin = BigInt(Math.round(parseFloat(quote.amountOutMin) * 1e6))
      const poolId    = BigInt(quote.poolId)

      // Build wSTX or token contract CV
      const toContractCV = (principal: string) => {
        const [addr, name] = principal.split('.')
        return stacks.contractPrincipalCV(addr, name)
      }

      const isSTXIn  = quote.tokenIn.symbol  === 'STX'
      const isSTXOut = quote.tokenOut.symbol === 'STX'

      // For STX swaps, use wSTX wrapper
      const tokenInContract  = isSTXIn  ? `${VELAR_ADDR}.wstx`  : quote.tokenIn.contract!
      const tokenOutContract = isSTXOut ? `${VELAR_ADDR}.wstx`  : quote.tokenOut.contract!

      // Determine token0/token1 based on pool
      const [t0addr, t0name] = quote.contracts.token0.split('.')
      const [t1addr, t1name] = quote.contracts.token1.split('.')
      const [sfaddr, sfname] = quote.contracts.shareFee.split('.')
      const [rtaddr, rtname] = quote.contracts.router.split('.')
      const [tiaddr, tiname] = tokenInContract.split('.')
      const [toaddr, toname] = tokenOutContract.split('.')

      await openContractCall({
        contractAddress:   rtaddr,
        contractName:      rtname,
        functionName:      'swap-exact-tokens-for-tokens',
        functionArgs:      [
          stacks.uintCV(poolId),
          toContractCV(quote.contracts.token0),
          toContractCV(quote.contracts.token1),
          stacks.contractPrincipalCV(tiaddr, tiname),
          stacks.contractPrincipalCV(toaddr, toname),
          stacks.contractPrincipalCV(sfaddr, sfname),
          stacks.uintCV(amtIn),
          stacks.uintCV(amtOutMin),
        ],
        postConditionMode: stacks.PostConditionMode.Allow,
        network:           'mainnet' as any,
        onFinish: (data: any) => {
          const tx = data?.txId || data?.txid
          if (tx) { setTxid(tx); setSwapping(false) }
          else setSwapping(false)
        },
        onCancel: () => setSwapping(false),
      })
    } catch (e: any) {
      setError(e?.message || 'Swap failed')
      setSwapping(false)
    }
  }

  const colorIn  = TOKEN_COLOR[action.tokenIn]  || '#fff'
  const colorOut = TOKEN_COLOR[action.tokenOut] || '#fff'

  if (loading) {
    return (
      <div style={{ marginTop: 10, padding: '14px', borderRadius: 12, background: 'rgba(0,255,159,0.03)', border: '1px solid rgba(0,255,159,0.1)' }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', marginBottom: 8 }}>FETCHING QUOTE…</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>{action.amount} {action.tokenIn} → {action.tokenOut}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ marginTop: 10, padding: '14px', borderRadius: 12, background: 'rgba(255,68,68,0.04)', border: '1px solid rgba(255,68,68,0.2)' }}>
        <div style={{ fontSize: 9, color: '#ff6666', letterSpacing: '0.2em', marginBottom: 4 }}>NO POOL FOUND</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 10 }}>{error}</div>
        <a href="https://app.alexlab.co/swap" target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 9, padding: '6px 12px', borderRadius: 7, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', textDecoration: 'none', fontFamily: 'inherit', letterSpacing: '0.15em' }}>
          TRY ALEX DEX ↗
        </a>
      </div>
    )
  }

  if (txid) {
    return (
      <div style={{ marginTop: 10, padding: '14px', borderRadius: 12, background: 'rgba(0,255,159,0.05)', border: '1px solid rgba(0,255,159,0.25)' }}>
        <div style={{ fontSize: 9, color: '#00ff9f', letterSpacing: '0.2em', marginBottom: 6 }}>✅ SWAP BROADCASTED</div>
        <a href={`https://explorer.hiro.so/txid/${txid}?chain=mainnet`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 10, color: '#00d4ff', textDecoration: 'none' }}>
          View on Explorer ↗
        </a>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 10, padding: '14px', borderRadius: 12, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>

      {/* Header */}
      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.2em', marginBottom: 12 }}>
        SWAP QUOTE // {quote!.dex.toUpperCase()} POOL #{quote!.poolId}
      </div>

      {/* Amounts */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ flex: 1, padding: '10px', borderRadius: 8, background: `${colorIn}08`, border: `1px solid ${colorIn}20` }}>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>YOU PAY</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: colorIn }}>{quote!.tokenIn.amount}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{quote!.tokenIn.symbol}</div>
        </div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>→</div>
        <div style={{ flex: 1, padding: '10px', borderRadius: 8, background: `${colorOut}08`, border: `1px solid ${colorOut}20` }}>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>YOU RECEIVE</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: colorOut }}>{parseFloat(quote!.tokenOut.amount).toLocaleString()}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{quote!.tokenOut.symbol}</div>
        </div>
      </div>

      {/* Details */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12, padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
        {[
          { l: 'Route',        v: quote!.route },
          { l: 'Fee',          v: quote!.fee },
          { l: 'Price Impact', v: quote!.priceImpact, warn: parseFloat(quote!.priceImpact) > 3 },
          { l: 'Min Received', v: `${parseFloat(quote!.amountOutMin).toLocaleString()} ${quote!.tokenOut.symbol}` },
        ].map(r => (
          <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9 }}>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>{r.l}</span>
            <span style={{ color: r.warn ? '#ff6666' : 'rgba(255,255,255,0.6)' }}>{r.v}</span>
          </div>
        ))}
      </div>

      {/* Slippage */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>SLIPPAGE</span>
        {[0.5, 1, 2, 5].map(s => (
          <button key={s} onClick={() => setSlippage(s)}
            style={{ padding: '3px 8px', borderRadius: 5, fontSize: 9, fontFamily: 'inherit', cursor: 'pointer', background: slippage === s ? 'rgba(0,255,159,0.15)' : 'rgba(255,255,255,0.04)', border: slippage === s ? '1px solid rgba(0,255,159,0.4)' : '1px solid rgba(255,255,255,0.08)', color: slippage === s ? '#00ff9f' : 'rgba(255,255,255,0.3)' }}>
            {s}%
          </button>
        ))}
      </div>

      {/* Swap button */}
      {!address ? (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '8px' }}>Connect wallet to swap</div>
      ) : (
        <button onClick={executeSwap} disabled={swapping}
          style={{ width: '100%', padding: '12px', borderRadius: 9, fontSize: 11, fontWeight: 700, letterSpacing: '0.2em', fontFamily: 'inherit', cursor: swapping ? 'not-allowed' : 'pointer', background: swapping ? 'rgba(255,255,255,0.05)' : '#00ff9f', border: 'none', color: swapping ? 'rgba(255,255,255,0.2)' : 'black' }}>
          {swapping ? 'CONFIRM IN WALLET…' : `▶ SWAP ${quote!.tokenIn.amount} ${quote!.tokenIn.symbol} → ${quote!.tokenOut.symbol}`}
        </button>
      )}
    </div>
  )
}