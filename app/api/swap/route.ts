// app/api/swap/route.ts
// Native swap quotes via Velar univ2-router (confirmed on-chain pool IDs)
import { NextRequest, NextResponse } from 'next/server'

const HIRO           = 'https://api.mainnet.hiro.so'
const VELAR_ADDR     = 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1'
const WSTX           = `${VELAR_ADDR}.wstx`
const SHARE_FEE_TO   = `${VELAR_ADDR}.univ2-share-fee-to`

// Confirmed Velar pools from on-chain transactions
export const VELAR_POOLS: Record<string, {
  id: number
  token0: string
  token1: string
  lp: string
  reversed?: boolean
}> = {
  'STX-WELSH': {
    id:     27,
    token0: WSTX,
    token1: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token',
    lp:     `${VELAR_ADDR}.wstx-welsh`,
  },
  'STX-USDCX': {
    id:     6,
    token0: WSTX,
    token1: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc',
    lp:     `${VELAR_ADDR}.wstx-aeusdc`,
  },
  'STX-VELAR': {
    id:     21,
    token0: `${VELAR_ADDR}.velar-token`,
    token1: WSTX,
    lp:     `${VELAR_ADDR}.velar-stx`,
    reversed: true,
  },
  'STX-LEO': {
    id:     28,
    token0: WSTX,
    token1: 'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token',
    lp:     `${VELAR_ADDR}.wstx-leo`,
  },
  'WELSH-USDCX': {
    id:     10,
    token0: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token',
    token1: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc',
    lp:     `${VELAR_ADDR}.welsh-aeusdc`,
  },
  'VELAR-USDCX': {
    id:     22,
    token0: `${VELAR_ADDR}.velar-token`,
    token1: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc',
    lp:     `${VELAR_ADDR}.velar-aeusdc`,
  },
}

// Official token registry
export const TOKENS: Record<string, {
  contract: string | null
  decimals: number
  symbol:   string
  name:     string
  color:    string
}> = {
  STX:   { contract: null,                                                                    decimals: 6, symbol: 'STX',   name: 'Stacks',         color: '#9945ff' },
  SBTC:  { contract: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',                decimals: 8, symbol: 'sBTC',  name: 'sBTC',           color: '#f7931a' },
  ALEX:  { contract: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex',                decimals: 8, symbol: 'ALEX',  name: 'ALEX Token',     color: '#00d4ff' },
  WELSH: { contract: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token',      decimals: 6, symbol: 'WELSH', name: 'Welshcorgicoin', color: '#ff6b9d' },
  VELAR: { contract: `${VELAR_ADDR}.velar-token`,                                            decimals: 6, symbol: 'VELAR', name: 'Velar',          color: '#00ff9f' },
  USDCX: { contract: 'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc',             decimals: 6, symbol: 'aeUSDC',name: 'aeUSDC',         color: '#2775ca' },
  USDA:  { contract: 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token',                decimals: 6, symbol: 'USDA',  name: 'USDA',           color: '#00d4ff' },
  B2S:   { contract: 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.b2s-token-v5',              decimals: 6, symbol: '$B2S',  name: 'Base2Stacks',    color: '#00ff9f' },
  LEO:   { contract: 'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token',                decimals: 6, symbol: 'LEO',   name: 'Leo',            color: '#ffd700' },
  STSTX: { contract: 'SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.ststx-token',               decimals: 6, symbol: 'stSTX', name: 'Stacked STX',    color: '#7b61ff' },
}

// Fetch pool reserves from on-chain
async function getPoolReserves(poolId: number): Promise<{ r0: bigint; r1: bigint } | null> {
  try {
    const hexId = poolId.toString(16).padStart(32, '0')
    const res   = await fetch(`${HIRO}/v2/contracts/call-read/${VELAR_ADDR}/univ2-core/get-pool`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        sender:    VELAR_ADDR,
        arguments: [`0x01${hexId}`],
      }),
    })
    const data = await res.json()
    if (!data.okay) return null

    const buf = Buffer.from(data.result.slice(2), 'hex')

    // Find reserve0 and reserve1 in the binary data
    // Pattern: marker bytes followed by 16-byte uint128
    let r0 = 0n, r1 = 0n
    for (let i = 0; i < buf.length - 20; i++) {
      // 'reserve0' = 72 65 73 65 72 76 65 30
      if (buf.slice(i, i+8).toString('hex') === '7265736572766530') {
        // Next byte should be 0x01 (uint type)
        if (buf[i+8] === 0x01) {
          r0 = BigInt('0x' + buf.slice(i+9, i+25).toString('hex'))
        }
      }
      // 'reserve1' = 72 65 73 65 72 76 65 31
      if (buf.slice(i, i+8).toString('hex') === '7265736572766531') {
        if (buf[i+8] === 0x01) {
          r1 = BigInt('0x' + buf.slice(i+9, i+25).toString('hex'))
        }
      }
    }

    if (r0 === 0n && r1 === 0n) return null
    return { r0, r1 }
  } catch {
    return null
  }
}

// AMM constant product formula
function calcAmountOut(amtIn: bigint, resIn: bigint, resOut: bigint, feeBps = 30n): bigint {
  if (resIn === 0n || resOut === 0n) return 0n
  const amtInFee = amtIn * (10000n - feeBps)
  return (amtInFee * resOut) / (resIn * 10000n + amtInFee)
}

function findPool(tokenIn: string, tokenOut: string) {
  const key  = `${tokenIn}-${tokenOut}`
  const keyR = `${tokenOut}-${tokenIn}`
  if (VELAR_POOLS[key])  return { pool: VELAR_POOLS[key],  reversed: false }
  if (VELAR_POOLS[keyR]) return { pool: VELAR_POOLS[keyR], reversed: true  }
  return null
}

const VALID_SWAP_TOKENS = new Set(Object.keys(TOKENS))

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const tokenIn  = searchParams.get('tokenIn')?.toUpperCase()
  const tokenOut = searchParams.get('tokenOut')?.toUpperCase()
  const amount   = searchParams.get('amount')

  // List supported tokens
  if (!tokenIn || !tokenOut) {
    return NextResponse.json({
      supported_tokens: Object.entries(TOKENS).map(([k, v]) => ({
        symbol: v.symbol, name: v.name, contract: v.contract, decimals: v.decimals,
      })),
      supported_pairs: Object.keys(VELAR_POOLS),
    })
  }

  if (!amount) {
    return NextResponse.json({ error: 'Missing amount param' }, { status: 400 })
  }

  if (!VALID_SWAP_TOKENS.has(tokenIn!) || !VALID_SWAP_TOKENS.has(tokenOut!)) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 })
  }

  const parsedAmount = parseFloat(amount!)
  if (isNaN(parsedAmount) || parsedAmount <= 0 || parsedAmount > 1000000) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const inToken  = TOKENS[tokenIn!]
  const outToken = TOKENS[tokenOut!]

  if (!inToken || !outToken) {
    return NextResponse.json({
      error:     `Unsupported token pair: ${tokenIn}/${tokenOut}`,
      supported: Object.keys(TOKENS),
    }, { status: 400 })
  }

  // Find direct pool
  const match = findPool(tokenIn, tokenOut)

  // Try STX routing for non-direct pairs
  let quote: any = null

  if (match) {
    const { pool, reversed: rev } = match
    const reserves = await getPoolReserves(pool.id)

    if (reserves) {
      const { r0, r1 } = reserves
      const amtIn      = BigInt(Math.round(parseFloat(amount) * 10 ** inToken.decimals))
      const resIn      = rev ? r1 : r0
      const resOut     = rev ? r0 : r1
      const amtOut     = calcAmountOut(amtIn, resIn, resOut)
      const impact     = resIn > 0n ? Number(amtIn * 10000n / resIn) / 100 : 0

      quote = {
        status:       'ok',
        dex:          'velar',
        poolId:       pool.id,
        tokenIn:      { symbol: inToken.symbol,  amount: amount,                                           contract: inToken.contract  },
        tokenOut:     { symbol: outToken.symbol, amount: (Number(amtOut) / 10 ** outToken.decimals).toFixed(6), contract: outToken.contract },
        amountOutMin: (Number(amtOut * 95n / 100n) / 10 ** outToken.decimals).toFixed(6),
        priceImpact:  `${impact.toFixed(2)}%`,
        fee:          '0.3%',
        route:        `${inToken.symbol} → ${outToken.symbol} (Velar Pool #${pool.id})`,
        reserveIn:    resIn.toString(),
        reserveOut:   resOut.toString(),
        contracts: {
          router:   `${VELAR_ADDR}.univ2-router`,
          token0:   pool.token0,
          token1:   pool.token1,
          shareFee: SHARE_FEE_TO,
        },
      }
    }
  }

  // Alex fallback for SBTC/ALEX
  if (!quote && (tokenIn === 'SBTC' || tokenOut === 'SBTC' || tokenIn === 'ALEX' || tokenOut === 'ALEX')) {
    quote = {
      status:  'ok',
      dex:     'alex',
      tokenIn: { symbol: inToken.symbol,  amount: amount },
      tokenOut:{ symbol: outToken.symbol, amount: 'see Alex DEX' },
      route:   `${inToken.symbol} → ${outToken.symbol} via Alex DEX`,
      url:     `https://app.alexlab.co/swap`,
      note:    'Open Alex DEX to execute this swap',
    }
  }

  if (!quote) {
    // Try via STX routing
    const viSTX1 = findPool(tokenIn, 'STX')
    const viSTX2 = findPool('STX', tokenOut)

    if (viSTX1 && viSTX2) {
      quote = {
        status: 'ok',
        dex:    'velar',
        route:  `${inToken.symbol} → STX → ${outToken.symbol} (2-hop)`,
        note:   'Multi-hop routing — execute in 2 swaps',
        hop1:   { pool: viSTX1.pool.id, from: inToken.symbol, to: 'STX' },
        hop2:   { pool: viSTX2.pool.id, from: 'STX', to: outToken.symbol },
      }
    } else {
      return NextResponse.json({
        error:      `No pool for ${tokenIn}/${tokenOut}`,
        suggestion: `Supported pairs: ${Object.keys(VELAR_POOLS).join(', ')}`,
      }, { status: 404 })
    }
  }

  return NextResponse.json(quote)
}