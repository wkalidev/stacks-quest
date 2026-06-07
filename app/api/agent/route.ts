// app/api/agent/route.ts
import { NextRequest, NextResponse } from 'next/server'

const GROQ_API = process.env.GROQ_API || ''
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Supported tokens
const TOKENS = {
  STX:   { decimals: 6, contract: null, symbol: 'STX' },
  SBTC:  { decimals: 8, contract: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token', symbol: 'sBTC' },
  B2S:   { decimals: 6, contract: 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.b2s-token-v4', symbol: '$B2S' },
  USDCX: { decimals: 6, contract: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx', symbol: 'USDCx' },
  ALEX:  { decimals: 8, contract: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex', symbol: 'ALEX' },
  WELSH: { decimals: 6, contract: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token', symbol: 'WELSH' },
}

const SYSTEM_PROMPT = `You are a non-custodial crypto agent running on Stacks (Bitcoin L2).
You help users manage their crypto portfolio, execute swaps, bridges, and check-ins.
You NEVER hold private keys. All transactions are signed by the user's wallet.

Supported tokens: STX, sBTC, $B2S, USDCx, ALEX, WELSH

DEX routing:
- STX/B2S, STX/USDCX → Velar DEX (velar.co)
- STX/sBTC, STX/ALEX → Alex DEX (alexlab.co)
- Cross-chain (Base↔Stacks) → Base2Stacks bridge (base2stacks-tracker.vercel.app)

When user asks to swap/buy/sell, respond with JSON action:
{
  "type": "swap",
  "tokenIn": "STX",
  "tokenOut": "B2S", 
  "amount": 10,
  "dex": "velar",
  "message": "I'll swap 10 STX for $B2S on Velar DEX"
}

When user asks for balance/portfolio:
{ "type": "query", "queryType": "portfolio", "message": "..." }

When user wants to bridge:
{ "type": "bridge", "fromChain": "base", "toChain": "stacks", "token": "USDC", "amount": 100, "message": "..." }

When user wants to check in:
{ "type": "checkin", "message": "Daily check-in costs 0.001 STX and builds your streak!" }

For general questions, respond normally without JSON.
Always be concise, helpful, and security-conscious.
Remind users you never control their funds.`

export async function POST(req: NextRequest) {
  try {
    const { messages, address } = await req.json()

    if (!GROQ_API) {
      return NextResponse.json({ error: 'GROQ_API not configured' }, { status: 500 })
    }

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + (address ? `\nUser wallet: ${address}` : '') },
          ...messages,
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    })

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Try to parse JSON action from response
    let action = null
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        action = JSON.parse(jsonMatch[0])
      }
    } catch {}

    return NextResponse.json({
      content,
      action,
      tokens: TOKENS,
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}