'use client'
import { CHAINS, ChainId } from '../app/lib/chains'

interface Props {
  selected: ChainId
  onChange: (chain: ChainId) => void
}

const CHAIN_GLOW: Record<ChainId, string> = {
  stacks: '#9945FF66',
  base:   '#0052FF66',
  celo:   '#FCBA2766',
}

export default function ChainSelector({ selected, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      {(Object.keys(CHAINS) as ChainId[]).map(chainId => {
        const chain      = CHAINS[chainId]
        const isSelected = selected === chainId
        const isLive     = !!chain.contracts.game
        return (
          <button
            key={chainId}
            onClick={() => onChange(chainId)}
            style={{
              padding:      '12px 28px',
              borderRadius: 30,
              fontSize:     15,
              fontWeight:   700,
              cursor:       'pointer',
              fontFamily:   'monospace',
              display:      'flex',
              alignItems:   'center',
              gap:          8,
              background:   isSelected ? chain.color : 'rgba(255,255,255,0.04)',
              color:        isSelected ? '#000' : chain.color,
              border:       `1px solid ${chain.color}${isSelected ? 'ff' : '44'}`,
              boxShadow:    isSelected ? `0 0 20px ${CHAIN_GLOW[chainId]}` : 'none',
              transition:   'all 0.2s',
            }}
          >
            {chain.icon} {chain.label}
            <span style={{
              fontSize:     9,
              fontWeight:   700,
              padding:      '2px 6px',
              borderRadius: 10,
              background:   isSelected ? 'rgba(0,0,0,0.25)' : `${chain.color}22`,
              color:        isSelected ? '#000' : chain.color,
              letterSpacing:'0.05em',
            }}>
              {isLive ? '🟢 LIVE' : '🔜 SOON'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
