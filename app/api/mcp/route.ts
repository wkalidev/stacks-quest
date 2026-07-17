import { NextRequest, NextResponse } from 'next/server'
import { callReadOnly, cvUint, cvBool, principalToHex } from '../../lib/stacksRead'

const APP_URL         = 'https://stacks-quest-ten.vercel.app'
const CONTRACT        = 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N'
const PAYMENT_ADDRESS = process.env.PAYMENT_ADDRESS || '0xDEAcDe6eC27Fd0cD972c1232C4f0d4171dda2357'
const USDC_BASE       = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const PRICE_USDC      = '1000000' // 1 USDC (6 decimals)

// x402 facilitator (verify + settle). Defaults to the public reference facilitator
// documented at https://x402.org — set X402_FACILITATOR_URL / X402_FACILITATOR_API_KEY
// to point at a production facilitator (e.g. Coinbase CDP) once one is provisioned.
// X402_STRICT_FACILITATOR=true blocks all premium calls if the facilitator is
// unreachable; default (false) degrades to structural-only validation so an outage
// on the facilitator's side doesn't take the whole MCP server down.
const FACILITATOR_URL    = process.env.X402_FACILITATOR_URL || 'https://x402.org/facilitator'
const FACILITATOR_KEY    = process.env.X402_FACILITATOR_API_KEY || ''
const STRICT_FACILITATOR = process.env.X402_STRICT_FACILITATOR === 'true'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Payment',
}

const PREMIUM_TOOLS = new Set(['get_swap_routes', 'get_staking_options', 'get_player_stats'])

const TOOLS = [
  {
    name:        'get_daily_puzzle',
    description: "Get today's Stacks Quest daily puzzle: question, token pools, and how to participate.",
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name:        'get_player_stats',
    description: "Get a player's stats: streak, total guesses, wins, lifetime earnings. Requires payment.",
    inputSchema: {
      type:       'object',
      properties: { address: { type: 'string', description: 'Stacks wallet address (SP...)' } },
      required:   ['address'],
    },
  },
  {
    name:        'get_agent_info',
    description: 'Get Stacks Quest Agent capabilities: supported commands, DEX routing, tokens.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name:        'get_staking_options',
    description: 'Get best staking options on Stacks: $B2S vault APY, STX stacking, LP yields. Requires payment.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name:        'get_swap_routes',
    description: 'Get swap routing info for Stacks tokens via Velar and Alex DEX. Requires payment.',
    inputSchema: {
      type:       'object',
      properties: {
        tokenIn:  { type: 'string', description: 'Input token (STX, B2S, USDCx, sBTC, ALEX, WELSH)' },
        tokenOut: { type: 'string', description: 'Output token' },
      },
      required: ['tokenIn', 'tokenOut'],
    },
  },
  {
    name:        'get_checkin_info',
    description: 'Get daily check-in info: cost, current streak rewards, contract address.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name:        'get_network_stats',
    description: 'Get live Stacks network stats via Hiro API: block height, mempool info.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
]

function paymentRequired(id: unknown, toolName: string): NextResponse {
  const requirements = {
    x402Version: 1,
    accepts: [{
      scheme:            'exact',
      network:           'base',
      maxAmountRequired: PRICE_USDC,
      resource:          `${APP_URL}/api/mcp`,
      description:       `Stacks Quest premium tool: ${toolName} — 1 USDC on Base`,
      mimeType:          'application/json',
      payTo:             PAYMENT_ADDRESS,
      maxTimeoutSeconds: 300,
      asset:             USDC_BASE,
      extra:             { name: 'USDC', decimals: 6, version: '2' },
    }],
  }
  return new NextResponse(
    JSON.stringify({
      jsonrpc: '2.0', id,
      error: { code: -32000, message: 'Payment required — send 1 USDC on Base with X-Payment header.' },
      // x402 spec requires `x402Version` and `accepts` at the TOP LEVEL of the
      // response body — generic x402 clients (e.g. x402-fetch's
      // wrapFetchWithPayment) read response.json().accepts directly and never
      // look at the X-Payment-Required header. Spreading `requirements` here
      // keeps this MCP-JSON-RPC-shaped for MCP clients while also being a
      // spec-compliant 402 body for plain x402 clients.
      ...requirements,
    }),
    {
      status:  402,
      headers: {
        'Content-Type':       'application/json',
        ...CORS,
        'X-Payment-Required': Buffer.from(JSON.stringify(requirements)).toString('base64'),
      },
    },
  )
}

// Structural validation of the X-Payment header (x402 "exact" scheme on Base/USDC).
//
// NOTE: this checks that the payment payload is well-formed, addressed to us, priced
// correctly, and not expired — it does NOT verify the EIP-3009 signature or that the
// transfer actually settled on-chain. That requires calling an x402 facilitator's
// /verify + /settle endpoints (see https://x402.org and SECURITY.md). Until that is
// wired up, treat this as a floor that blocks trivial/garbage headers, not a guarantee
// that payment was received.
function isPaymentPayloadValid(headerValue: string): boolean {
  try {
    const decoded = Buffer.from(headerValue, 'base64').toString('utf8')
    const parsed  = JSON.parse(decoded)

    const auth = parsed?.payload?.authorization ?? parsed?.authorization
    if (!auth) return false

    if (parsed.scheme && parsed.scheme !== 'exact') return false
    if (parsed.network && parsed.network !== 'base') return false

    const to = String(auth.to || '').toLowerCase()
    if (to !== PAYMENT_ADDRESS.toLowerCase()) return false

    const value = BigInt(auth.value ?? 0)
    if (value < BigInt(PRICE_USDC)) return false

    const nowSec = Math.floor(Date.now() / 1000)
    if (auth.validBefore !== undefined && Number(auth.validBefore) < nowSec) return false
    if (auth.validAfter !== undefined && Number(auth.validAfter) > nowSec) return false

    const signature = parsed?.payload?.signature ?? parsed?.signature
    if (typeof signature !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(signature)) return false

    return true
  } catch {
    return false
  }
}

// Calls a real x402 facilitator's /verify then /settle endpoints so premium tools are
// only served against payments that actually settle on-chain, not just well-formed
// headers. Falls back to "pass" (structural-only, same as before) if the facilitator
// itself is unreachable, unless X402_STRICT_FACILITATOR=true.
//
// NOTE: this cannot be live-tested from this environment (no outbound network access
// to x402.org here) — verified for syntax/type-correctness only. Test against a real
// facilitator + a real signed payment before relying on it in production.
async function facilitatorVerifyAndSettle(headerValue: string, toolName: string): Promise<boolean> {
  let paymentPayload: unknown
  try {
    paymentPayload = JSON.parse(Buffer.from(headerValue, 'base64').toString('utf8'))
  } catch {
    return false
  }

  const paymentRequirements = {
    scheme:            'exact',
    network:           'base',
    maxAmountRequired: PRICE_USDC,
    resource:          `${APP_URL}/api/mcp`,
    description:       `Stacks Quest premium tool: ${toolName} — 1 USDC on Base`,
    mimeType:          'application/json',
    payTo:             PAYMENT_ADDRESS,
    maxTimeoutSeconds: 300,
    asset:             USDC_BASE,
    extra:             { name: 'USDC', decimals: 6, version: '2' },
  }

  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (FACILITATOR_KEY) authHeaders['Authorization'] = `Bearer ${FACILITATOR_KEY}`

  try {
    const verifyRes = await fetch(`${FACILITATOR_URL}/verify`, {
      method:  'POST',
      headers: authHeaders,
      body:    JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements }),
      signal:  AbortSignal.timeout(8000),
    })
    if (!verifyRes.ok) return !STRICT_FACILITATOR
    const verifyData = await verifyRes.json().catch(() => null)
    if (!verifyData || verifyData.isValid !== true) return false

    const settleRes = await fetch(`${FACILITATOR_URL}/settle`, {
      method:  'POST',
      headers: authHeaders,
      body:    JSON.stringify({ x402Version: 1, paymentPayload, paymentRequirements }),
      signal:  AbortSignal.timeout(8000),
    })
    if (!settleRes.ok) return !STRICT_FACILITATOR
    const settleData = await settleRes.json().catch(() => null)
    return settleData?.success === true
  } catch {
    // Facilitator unreachable (network error, timeout, DNS, etc).
    return !STRICT_FACILITATOR
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

export async function GET() {
  return NextResponse.json(
    {
      name:     'Stacks Quest MCP Server',
      version:  '1.0.0',
      protocol: 'MCP 2024-11-05',
      tools:    TOOLS.map(t => ({
        name:        t.name,
        description: t.description,
        premium:     PREMIUM_TOOLS.has(t.name),
      })),
      status:   'healthy',
      endpoint: `${APP_URL}/api/mcp`,
      payment: {
        supported:    true,
        scheme:       'x402',
        network:      'base',
        asset:        'USDC',
        pricePerCall: '1.00',
      },
    },
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Bad request' }, { status: 400, headers: CORS })
    }

    const { method, params, id } = body

    if (method === 'initialize') {
      return NextResponse.json({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities:    { tools: {} },
          serverInfo:      { name: 'stacks-quest-mcp', version: '1.0.0' },
        },
      }, { headers: CORS })
    }

    if (method === 'notifications/initialized') {
      return NextResponse.json({ jsonrpc: '2.0', id, result: {} }, { headers: CORS })
    }

    if (method === 'tools/list') {
      return NextResponse.json({ jsonrpc: '2.0', id, result: { tools: TOOLS } }, { headers: CORS })
    }

    if (method === 'resources/list') {
      return NextResponse.json({ jsonrpc: '2.0', id, result: { resources: [] } }, { headers: CORS })
    }

    if (method === 'prompts/list') {
      return NextResponse.json({ jsonrpc: '2.0', id, result: { prompts: [] } }, { headers: CORS })
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params as { name: string; arguments?: Record<string, unknown> }

      if (PREMIUM_TOOLS.has(name)) {
        const paymentHeader = req.headers.get('x-payment')
        if (!paymentHeader || !isPaymentPayloadValid(paymentHeader)) return paymentRequired(id, name)

        const settled = await facilitatorVerifyAndSettle(paymentHeader, name)
        if (!settled) return paymentRequired(id, name)
      }

      if (name === 'get_daily_puzzle') {
        const puzzleNumber = Math.floor(Date.now() / 86400000)
        return NextResponse.json({
          jsonrpc: '2.0', id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                puzzle_number: puzzleNumber,
                contract:      `${CONTRACT}.stacks-quest-v3`,
                token_pools:   ['STX', '$B2S', 'USDCx', 'sBTC'],
                bet_range:     { min: '1 STX / 1 B2S / 1 USDCx / 0.00001 sBTC', max: '100 STX / 100 B2S / 100 USDCx / 0.001 sBTC' },
                guess_limit:   '1 per player per day',
                // v3 uses commit-reveal: the answer is not known on-chain until
                // the owner calls reveal-answer after the game window closes.
                // Correct guessers then call register-win, then claim-reward.
                result_flow:   'commit-reveal: play now, answer revealed after the window closes, then register-win + claim-reward',
                app:           `${APP_URL}/game`,
              }, null, 2),
            }],
          },
        }, { headers: CORS })
      }

      if (name === 'get_player_stats') {
        const { address } = (args || {}) as { address?: string }
        if (!address || !/^SP[A-Z0-9]{1,40}$/.test(address)) {
          return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid Stacks address' } }, { headers: CORS })
        }
        try {
          const argHex     = principalToHex(address)
          const streak     = await callReadOnly(CONTRACT, 'stacks-quest-agent-v3', 'get-streak', [argHex], address)
          const checkedIn  = await callReadOnly(CONTRACT, 'stacks-quest-agent-v3', 'has-checked-in-today', [argHex], address)

          if (!streak) throw new Error('read-only call failed')

          return NextResponse.json({
            jsonrpc: '2.0', id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  address,
                  streak:            cvUint(streak, 'current-streak'),
                  best_streak:       cvUint(streak, 'best-streak'),
                  total_checkins:    cvUint(streak, 'total-checkins'),
                  checked_in_today:  checkedIn ? cvBool(checkedIn) : null,
                  app: `${APP_URL}/agent`,
                }, null, 2),
              }],
            },
          }, { headers: CORS })
        } catch {
          return NextResponse.json({
            jsonrpc: '2.0', id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify({ address, note: 'Could not fetch on-chain data. Visit the app to see your stats.', app: `${APP_URL}/agent` }),
              }],
            },
          }, { headers: CORS })
        }
      }

      if (name === 'get_agent_info') {
        return NextResponse.json({
          jsonrpc: '2.0', id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                languages:    ['EN', 'FR', 'ES', 'ZH', 'AR', 'PT'],
                capabilities: ['portfolio', 'swap', 'bridge', 'checkin', 'staking_info', 'defi_education'],
                dex_routing: {
                  'STX/B2S':   'Velar DEX',
                  'STX/USDCx': 'Velar DEX',
                  'STX/sBTC':  'Alex DEX',
                  'STX/ALEX':  'Alex DEX',
                },
                bridge:   'Base2Stacks (base2stacks-tracker.vercel.app)',
                security: 'Non-custodial — user always signs their own transactions',
                payment:  { supported: true, network: 'base', asset: 'USDC', pricePerCall: '1.00 USDC' },
                app:      `${APP_URL}/agent`,
              }, null, 2),
            }],
          },
        }, { headers: CORS })
      }

      if (name === 'get_staking_options') {
        return NextResponse.json({
          jsonrpc: '2.0', id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                options: [
                  { name: '$B2S Vault v2', apy: '37.5%', lock: '365 days', risk: 'LOW',    protocol: 'Base2Stacks' },
                  { name: '$B2S Vault v2', apy: '25%',   lock: '70 days',  risk: 'LOW',    protocol: 'Base2Stacks' },
                  { name: '$B2S Vault v2', apy: '12.5%', lock: 'None',     risk: 'LOW',    protocol: 'Base2Stacks' },
                  { name: 'STX Stacking',  apy: '~8%',   lock: '2 weeks',  risk: 'LOW',    protocol: 'Proof of Transfer' },
                  { name: 'STX/WELSH LP',  apy: 'variable', lock: 'None',  risk: 'MEDIUM', protocol: 'Velar DEX' },
                ],
                app: 'https://base2stacks-tracker.vercel.app/#staking',
              }, null, 2),
            }],
          },
        }, { headers: CORS })
      }

      if (name === 'get_swap_routes') {
        const VALID_TOKENS = ['STX', 'B2S', 'USDCx', 'sBTC', 'ALEX', 'WELSH']
        const { tokenIn, tokenOut } = (args || {}) as { tokenIn?: string; tokenOut?: string }
        if (!tokenIn || !tokenOut || !VALID_TOKENS.includes(tokenIn) || !VALID_TOKENS.includes(tokenOut)) {
          return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid token — valid: ' + VALID_TOKENS.join(', ') } }, { headers: CORS })
        }
        const velarPairs = [['STX','B2S'],['STX','USDCx'],['STX','WELSH']]
        const alexPairs  = [['STX','sBTC'],['STX','ALEX']]
        const isVelar    = velarPairs.some(([a, b]) => (tokenIn === a && tokenOut === b) || (tokenIn === b && tokenOut === a))
        const isAlex     = alexPairs.some(([a, b])  => (tokenIn === a && tokenOut === b) || (tokenIn === b && tokenOut === a))
        return NextResponse.json({
          jsonrpc: '2.0', id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                pair:            `${tokenIn}/${tokenOut}`,
                recommended_dex: isVelar ? 'Velar DEX' : isAlex ? 'Alex DEX' : 'No direct route — consider multi-hop via STX',
                app:             `${APP_URL}/agent`,
              }, null, 2),
            }],
          },
        }, { headers: CORS })
      }

      if (name === 'get_checkin_info') {
        return NextResponse.json({
          jsonrpc: '2.0', id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                cost:           '0.001 STX',
                streak_bonuses: { '7 days': '+0.002 STX', '30 days': '+0.01 STX', '100 days': '+0.05 STX' },
                contract:       `${CONTRACT}.stacks-quest-agent-v3`,
                app:            `${APP_URL}/agent`,
              }, null, 2),
            }],
          },
        }, { headers: CORS })
      }

      if (name === 'get_network_stats') {
        try {
          const res  = await fetch('https://api.mainnet.hiro.so/v2/info', { next: { revalidate: 30 } })
          const data = res.ok ? await res.json() : {}
          return NextResponse.json({
            jsonrpc: '2.0', id,
            result: { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] },
          }, { headers: CORS })
        } catch {
          return NextResponse.json({
            jsonrpc: '2.0', id,
            result: { content: [{ type: 'text', text: '{"error":"Could not fetch network stats"}' }] },
          }, { headers: CORS })
        }
      }

      return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Tool not found: ${name}` } }, { headers: CORS })
    }

    if (method === 'ping') {
      return NextResponse.json({ jsonrpc: '2.0', id, result: {} }, { headers: CORS })
    }

    return NextResponse.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } }, { headers: CORS })
  } catch {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      { status: 400, headers: CORS },
    )
  }
}
