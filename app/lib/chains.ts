export const CHAINS = {
  stacks: {
    id:       'stacks',
    name:     'Stacks',
    label:    'Stacks',
    color:    '#9945ff',
    icon:     '🟣',
    explorer: 'https://explorer.hiro.so',
    tokens: [
      { symbol: 'STX',    label: 'STX',    address: null,                                                              decimals: 6,  color: '#9945ff', native: true  },
      { symbol: 'B2S',    label: '$B2S',   address: 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.b2s-token-v4',        decimals: 6,  color: '#00ff9f', native: false },
      { symbol: 'USDCX',  label: 'USDCx',  address: 'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx',              decimals: 6,  color: '#2775ca', native: false },
      { symbol: 'AEUSDC', label: 'aeUSDC', address: 'SP3Y2ZSH8P7D50B0JBTCSJ7E9VER8HDVT0W8K0QQZ.token-aeusdc',      decimals: 6,  color: '#00adef', native: false },
      { symbol: 'SBTC',   label: 'sBTC',   address: 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',         decimals: 8,  color: '#f7931a', native: false },
    ],
    contracts: {
      game:    process.env.NEXT_PUBLIC_STACKS_QUEST_GAME    || 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.stacks-quest-v2',
      checkIn: process.env.NEXT_PUBLIC_STACKS_QUEST_CHECKIN || 'SP1V72500C63KN9E348QDK9X879MASSTN0J3KBQ5N.stacks-quest-agent-v3',
    },
  },
  base: {
    id:       'base',
    name:     'Base',
    label:    'Base',
    color:    '#0052ff',
    icon:     '🔵',
    chainId:  8453,
    explorer: 'https://basescan.org',
    rpc:      'https://mainnet.base.org',
    tokens: [
      { symbol: 'ETH',  label: 'ETH',  address: null,                                          decimals: 18, color: '#627eea', native: true  },
      { symbol: 'USDC', label: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6,  color: '#2775ca', native: false },
      { symbol: 'USDT', label: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6,  color: '#26a17b', native: false },
    ],
    contracts: {
      game:    process.env.NEXT_PUBLIC_BASE_QUEST_GAME    || '0xE355F73B188713f60F42552d942383303EDE313f',
      checkIn: process.env.NEXT_PUBLIC_BASE_QUEST_CHECKIN || '0x63529080bb946ED0611c4DC6521a9CcC7579b2FB',
    },
  },
  celo: {
    id:       'celo',
    name:     'Celo',
    label:    'Celo',
    color:    '#fcb428',
    icon:     '🟡',
    chainId:  42220,
    explorer: 'https://celoscan.io',
    rpc:      'https://forno.celo.org',
    tokens: [
      { symbol: 'CELO', label: 'CELO', address: null,                                          decimals: 18, color: '#fcb428', native: true  },
      { symbol: 'CUSD', label: 'cUSD', address: '0x765DE816845861e75A25fCA122bb6898B8B1282a', decimals: 18, color: '#35d07f', native: false },
    ],
    contracts: {
      game:    process.env.NEXT_PUBLIC_CELO_QUEST_GAME    || '0x23B7ac7a7171322B1DAF1c8887e47e0C0c181735',
      checkIn: process.env.NEXT_PUBLIC_CELO_QUEST_CHECKIN || '0x21ad9DDFB07d67c46d0949d887394c70be145775',
    },
  },
} as const

export type ChainId = keyof typeof CHAINS
export type Chain   = typeof CHAINS[ChainId]
