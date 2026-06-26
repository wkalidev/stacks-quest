import { NextRequest, NextResponse } from 'next/server'

const HIRO_BASE    = 'https://api.hiro.so'
const HIRO_MAINNET = 'https://api.mainnet.hiro.so'

const ALLOWED_PREFIXES = [
  '/v2/info',
  '/v2/accounts/',
  '/v2/fees/',
  '/v2/contracts/call-read/',
  '/extended/v1/address/',
  '/extended/v1/tx/',
  '/extended/v1/block/',
  '/extended/v1/search/',
  '/metadata/v1/ft/',
  '/metadata/v1/nft/',
]

function isAllowedPath(path: string): boolean {
  return ALLOWED_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix))
}

async function proxyRequest(path: string, options: RequestInit = {}) {
  const base = path.startsWith('/metadata') ? HIRO_BASE : HIRO_MAINNET

  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    next: { revalidate: 30 },
  })

  let data
  try {
    data = await response.json()
  } catch {
    data = { results: [], total: 0 }
  }

  if (!response.ok) {
    return NextResponse.json(
      { results: [], total: 0, error: data?.error ?? 'Not found' },
      { status: 200 },
    )
  }

  return NextResponse.json(data, { status: 200 })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  if (!isAllowedPath(path)) return NextResponse.json({ error: 'Path not allowed' }, { status: 403 })

  try {
    return await proxyRequest(path)
  } catch {
    return NextResponse.json({ results: [], total: 0 }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })
  if (!isAllowedPath(path)) return NextResponse.json({ error: 'Path not allowed' }, { status: 403 })

  try {
    const body = await request.json()
    return await proxyRequest(path, {
      method: 'POST',
      body:   JSON.stringify(body),
    })
  } catch {
    return NextResponse.json({ result: null }, { status: 200 })
  }
}
