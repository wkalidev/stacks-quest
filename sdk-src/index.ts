/**
 * @wkalidev/stacks-quest-sdk
 * Universal SDK for the Stacks Quest multichain puzzle game
 * Supports: Stacks, Base, Celo
 */

export type Chain       = 'stacks' | 'base' | 'celo'
export type TokenSymbol = 'STX' | 'B2S' | 'USDCX' | 'AEUSDC' | 'SBTC' | 'ETH' | 'USDC' | 'USDT' | 'CELO' | 'CUSD'

export interface Puzzle {
  id:           number
  question:     string
  hint:         string
  type:         string
  deadline:     number
  finalized:    boolean
  totalPlayers: number
  prizePool:    string
}

export interface PlayerStats {
  address:       string
  streak:        number
  totalCheckIns: number
  lastCheckIn:   number
  canCheckIn:    boolean
  nextCheckIn:   number
}

export interface QuestSDKOptions {
  baseRpc?:    string
  celoRpc?:    string
  hiroApiKey?: string
  contracts?: {
    baseGame?:     string
    baseCheckIn?:  string
    celoGame?:     string
    celoCheckIn?:  string
  }
}

export class StacksQuestSDK {
  private opts: QuestSDKOptions

  private readonly DEFAULTS = {
    baseRpc:        'https://mainnet.base.org',
    celoRpc:        'https://forno.celo.org',
    hiroApi:        'https://api.mainnet.hiro.so',
    stacksContract: 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N',
    appUrl:         'https://stacks-quest-ten.vercel.app',
  }

  constructor(opts: QuestSDKOptions = {}) {
    this.opts = opts
  }

  /** MCP server endpoint URL */
  getMCPEndpoint(): string {
    return `${this.DEFAULTS.appUrl}/api/mcp`
  }

  /** A2A agent card URL */
  getAgentCard(): string {
    return `${this.DEFAULTS.appUrl}/.well-known/agent-card.json`
  }

  /** App URL */
  getAppURL(): string {
    return this.DEFAULTS.appUrl
  }

  /** Get today's puzzle for a given chain */
  async getPuzzle(chain: Chain): Promise<Puzzle | null> {
    try {
      const res = await fetch(`${this.DEFAULTS.appUrl}/api/puzzle?chain=${chain}`)
      if (!res.ok) return null
      return res.json() as Promise<Puzzle>
    } catch {
      return null
    }
  }

  /** Get player stats for a given chain */
  async getPlayerStats(address: string, chain: Chain): Promise<PlayerStats | null> {
    if (!address) throw new Error('StacksQuestSDK: address required')
    if (chain === 'stacks' && !/^SP[A-Z0-9]+$/.test(address)) {
      throw new Error('StacksQuestSDK: invalid Stacks address')
    }
    if (chain !== 'stacks' && !/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error('StacksQuestSDK: invalid EVM address')
    }
    try {
      const res = await fetch(
        `${this.DEFAULTS.appUrl}/api/player?address=${address}&chain=${chain}`
      )
      if (!res.ok) return null
      return res.json() as Promise<PlayerStats>
    } catch {
      return null
    }
  }

  /** Get live Stacks network stats */
  async getNetworkStats(): Promise<Record<string, unknown> | null> {
    try {
      const res = await fetch(`${this.DEFAULTS.hiroApi}/v2/info`)
      if (!res.ok) return null
      return res.json() as Promise<Record<string, unknown>>
    } catch {
      return null
    }
  }

  /** Get supported tokens for a chain */
  getSupportedTokens(chain: Chain): TokenSymbol[] {
    const map: Record<Chain, TokenSymbol[]> = {
      stacks: ['STX', 'B2S', 'USDCX', 'AEUSDC', 'SBTC'],
      base:   ['ETH', 'USDC', 'USDT'],
      celo:   ['CELO', 'CUSD'],
    }
    return map[chain]
  }

  /** Get contract addresses for a chain */
  getContracts(chain: Chain): { game: string; checkIn: string } {
    const map: Record<Chain, { game: string; checkIn: string }> = {
      stacks: {
        game:    `${this.DEFAULTS.stacksContract}.stacks-quest-v2`,
        checkIn: `${this.DEFAULTS.stacksContract}.stacks-quest-agent-v3`,
      },
      base: {
        game:    this.opts.contracts?.baseGame    || '',
        checkIn: this.opts.contracts?.baseCheckIn || '',
      },
      celo: {
        game:    this.opts.contracts?.celoGame    || '',
        checkIn: this.opts.contracts?.celoCheckIn || '',
      },
    }
    return map[chain]
  }
}

export default StacksQuestSDK
