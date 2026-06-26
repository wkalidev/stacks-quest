import { NextResponse } from 'next/server'

const APP_URL         = 'https://stacks-quest-ten.vercel.app'
const PAYMENT_ADDRESS = process.env.PAYMENT_ADDRESS || '0xDEAcDe6eC27Fd0cD972c1232C4f0d4171dda2357'
const USDC_BASE       = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Content-Type':                 'application/json',
  'Cache-Control':                'public, max-age=3600',
}

const card = {
  name:             'Stacks Quest Agent',
  description:      'Daily blockchain puzzle game and non-custodial DeFi agent on Stacks (Bitcoin L2). Swap tokens via Velar/Alex DEX, bridge from Base to Stacks, earn streak rewards with daily check-ins.',
  url:              APP_URL,
  version:          '1.0.0',
  documentationUrl: 'https://github.com/wkalidev/stacks-quest#readme',
  provider: {
    organization: 'wkalidev',
    url:          'https://github.com/wkalidev',
  },
  capabilities: {
    streaming:              false,
    pushNotifications:      false,
    stateTransitionHistory: false,
  },
  authentication: {
    schemes: ['none'],
  },
  defaultInputModes:  ['text/plain'],
  defaultOutputModes: ['text/plain'],
  skills: [
    {
      id:          'daily_puzzle',
      name:        'Daily Puzzle',
      description: 'Guess real Stacks blockchain data (block height, price, tx count), bet tokens (STX/$B2S/USDCx/sBTC), win reward pool. One guess per day, hot/warm/cold hints.',
      tags:        ['puzzle', 'blockchain', 'stacks', 'betting', 'game', 'bitcoin-l2'],
      inputModes:  ['text/plain'],
      outputModes: ['text/plain'],
      examples:    ["What is today's puzzle?", 'Play the daily puzzle'],
    },
    {
      id:          'swap',
      name:        'Token Swap',
      description: 'Route token swaps via Velar DEX (STX/WELSH/USDCx) and Alex DEX (STX/sBTC/ALEX). Non-custodial — user always signs their own transactions.',
      tags:        ['defi', 'swap', 'dex', 'stacks', 'velar', 'alex', 'tokens'],
      inputModes:  ['text/plain'],
      outputModes: ['text/plain'],
      examples:    ['Swap 10 STX for WELSH', 'Get a swap quote for STX to sBTC'],
    },
    {
      id:          'bridge',
      name:        'Cross-chain Bridge',
      description: 'Bridge assets from Base Network to Stacks via Base2Stacks. Non-custodial.',
      tags:        ['bridge', 'cross-chain', 'base', 'stacks', 'defi'],
      inputModes:  ['text/plain'],
      outputModes: ['text/plain'],
      examples:    ['Bridge USDC from Base to Stacks', 'How do I bridge to Stacks?'],
    },
    {
      id:          'checkin',
      name:        'Daily Check-in',
      description: 'Submit 0.001 STX daily check-in on-chain. Build streak, earn bonus rewards at 7/30/100-day milestones.',
      tags:        ['checkin', 'streak', 'rewards', 'stacks', 'on-chain'],
      inputModes:  ['text/plain'],
      outputModes: ['text/plain'],
      examples:    ['Daily check-in', 'What is my current streak?'],
    },
    {
      id:          'portfolio',
      name:        'Portfolio',
      description: 'Real-time token balances: STX, sBTC, $B2S, USDCx, ALEX, WELSH via Hiro API.',
      tags:        ['portfolio', 'balances', 'stacks', 'defi', 'tokens'],
      inputModes:  ['text/plain'],
      outputModes: ['text/plain'],
      examples:    ['Show my portfolio', 'What is my STX balance?'],
    },
    {
      id:          'staking_info',
      name:        'Staking Info',
      description: 'Live staking options on Stacks: $B2S vaults (up to 37.5% APY), STX stacking (~8% BTC yield), LP positions on Velar DEX.',
      tags:        ['staking', 'apy', 'defi', 'stacks', 'yield', 'b2s'],
      inputModes:  ['text/plain'],
      outputModes: ['text/plain'],
      examples:    ['Show staking options', 'Best APY on Stacks?'],
    },
  ],
  x402: {
    supported:    true,
    network:      'base',
    asset:        USDC_BASE,
    symbol:       'USDC',
    decimals:     6,
    payTo:        PAYMENT_ADDRESS,
    pricePerCall: '1000000',
    premiumTools: ['get_swap_routes', 'get_staking_options', 'get_player_stats'],
    endpoint:     `${APP_URL}/api/mcp`,
  },
  mcp: {
    url:      `${APP_URL}/api/mcp`,
    version:  '2024-11-05',
    protocol: 'mcp',
    tools: [
      'get_daily_puzzle', 'get_player_stats', 'get_agent_info',
      'get_staking_options', 'get_swap_routes', 'get_checkin_info', 'get_network_stats',
    ],
  },
  oasf: {
    version: '1.0.0',
    schema:  'https://schema.oasf.dev/v1/agent',
    domains: ['blockchain/stacks', 'finance/defi', 'gaming/puzzle', 'bitcoin-l2'],
    tasks: [
      { id: 'daily_puzzle',  name: 'Daily Puzzle',      input: 'text', output: 'text', premium: false },
      { id: 'token_swap',    name: 'Token Swap',         input: 'text', output: 'text', premium: true,  price: { currency: 'USDC', amount: '1.00', network: 'base' } },
      { id: 'bridge',        name: 'Cross-chain Bridge', input: 'text', output: 'text', premium: false },
      { id: 'checkin',       name: 'Daily Check-in',    input: 'text', output: 'text', premium: false },
      { id: 'portfolio',     name: 'Portfolio Query',    input: 'text', output: 'text', premium: false },
      { id: 'staking_info',  name: 'Staking Info',      input: 'text', output: 'text', premium: true,  price: { currency: 'USDC', amount: '1.00', network: 'base' } },
      { id: 'player_stats',  name: 'Player Stats',      input: 'text', output: 'text', premium: true,  price: { currency: 'USDC', amount: '1.00', network: 'base' } },
    ],
  },
}

export async function GET() {
  return NextResponse.json(card, { headers: CORS })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
