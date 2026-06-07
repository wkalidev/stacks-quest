// app/api/agent/route.ts
import { NextRequest, NextResponse } from 'next/server'

const GROQ_API = process.env.GROQ_API || ''
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const TOKENS = {
  STX:   { decimals: 6, contract: null, symbol: 'STX' },
  SBTC:  { decimals: 8, contract: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token', symbol: 'sBTC' },
  B2S:   { decimals: 6, contract: 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.b2s-token-v4', symbol: '$B2S' },
  USDCX: { decimals: 6, contract: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx', symbol: 'USDCx' },
  ALEX:  { decimals: 8, contract: 'SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex', symbol: 'ALEX' },
  WELSH: { decimals: 6, contract: 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token', symbol: 'WELSH' },
}

const SYSTEM_PROMPT = `You are STACKS_AGENT — an intelligent, friendly non-custodial crypto assistant on Stacks (Bitcoin L2).

PERSONALITY:
- Warm, direct, and encouraging
- Guide the user step by step
- Never be robotic — be conversational

CAPABILITIES:
1. Portfolio — real-time balances (STX, sBTC, $B2S, USDCx, ALEX, WELSH)
2. Swap — route to best DEX (Velar or Alex)
3. Bridge — cross-chain Base <-> Stacks
4. Daily check-in — 0.001 STX fee, streak rewards
5. DeFi education — staking, APY, pools, bridges

SUPPORTED TOKENS: STX, sBTC, $B2S, USDCx, ALEX, WELSH

DEX ROUTING:
- STX/$B2S, STX/USDCx -> Velar DEX
- STX/sBTC, STX/ALEX -> Alex DEX
- Base <-> Stacks -> Base2Stacks bridge

SECURITY: Never ask for keys. Never hold funds. Always: "you sign, you control".

CRITICAL RESPONSE RULES:
1. For ANY balance/portfolio question: your response MUST end with this exact JSON on the last line:
{"type":"query","queryType":"portfolio","message":"Fetching your balances now..."}

2. For swap requests:
{"type":"swap","tokenIn":"STX","tokenOut":"WELSH","amount":10,"dex":"velar","message":"Routing swap via Velar DEX."}

3. For bridge requests:
{"type":"bridge","fromChain":"base","toChain":"stacks","token":"USDC","amount":100,"message":"Opening bridge."}

4. For check-in:
{"type":"checkin","message":"Daily check-in costs 0.001 STX and builds your streak!"}

IMPORTANT: The JSON action on the last line is what TRIGGERS the actual on-chain action. Without it, nothing happens. Always include it for actionable requests.

EXAMPLES:

User: "check my $B2S balance" or "show portfolio" or "what tokens do I have"
Response: I'll fetch your live balances right now across all supported tokens.
{"type":"query","queryType":"portfolio","message":"Fetching your balances now..."}

User: "swap 10 STX for WELSH"
Response: I'll route this through Velar DEX, pool #27.
{"type":"swap","tokenIn":"STX","tokenOut":"WELSH","amount":10,"dex":"velar","message":"Routing via Velar."}

User: "how do I earn yield?"
Response: On Stacks you have great options:
1. Stake $B2S - up to 37.5% APY with lock multipliers
2. Add STX/WELSH liquidity on Velar - earn swap fees
3. Stack STX natively - earn BTC yield

Want to see your current balances to plan your strategy?
{"type":"query","queryType":"portfolio","message":"Let me check what you have to work with."}

Always end responses with the next logical action.`

export async function POST(req: NextRequest) {
  try {
    const { messages, address, systemExtra } = await req.json()

    if (!GROQ_API) {
      return NextResponse.json({ error: 'GROQ_API not configured' }, { status: 500 })
    }

    const systemWithContext = SYSTEM_PROMPT
      + (systemExtra ? '\n' + systemExtra : '')
      + (address
        ? `\n\nUSER WALLET: ${address} (Stacks Mainnet) - already connected, use this for all balance queries`
        : '\n\nWallet not connected. Encourage user to connect.')

    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemWithContext },
          ...messages,
        ],
        max_tokens:  800,
        temperature: 0.4,
      }),
    })

    const data    = await response.json()
    const content = data.choices?.[0]?.message?.content || ''

    // Extract JSON action from last line
    let action = null
    try {
      const lines = content.trim().split('\n')
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim()
        if (line.startsWith('{') && line.includes('"type"')) {
          action = JSON.parse(line)
          break
        }
      }
    } catch {}

    // Remove JSON from displayed content
    const displayContent = content
      .split('\n')
      .filter((line: string) => {
        const t = line.trim()
        return !(t.startsWith('{') && t.includes('"type"'))
      })
      .join('\n')
      .trim()

    return NextResponse.json({ content: displayContent, action, tokens: TOKENS })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}