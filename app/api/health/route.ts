import { NextResponse } from 'next/server'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type':                'application/json',
}

export async function GET() {
  return NextResponse.json(
    {
      status:    'healthy',
      service:   'stacks-quest',
      version:   '1.0.0',
      timestamp: new Date().toISOString(),
      endpoints: {
        agent:     '/agent',
        game:      '/game',
        mcp:       '/api/mcp',
        agentCard: '/.well-known/agent-card.json',
      },
      chains: ['stacks', 'base', 'celo'],
    },
    { headers: CORS },
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
