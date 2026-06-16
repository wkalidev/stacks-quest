'use client'
import { CHAINS, ChainId } from '../app/lib/chains'

interface Props {
  selected: ChainId
  onChange: (chain: ChainId) => void
}

export default function ChainSelector({ selected, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {(Object.keys(CHAINS) as ChainId[]).map(chainId => {
        const chain = CHAINS[chainId]
        const isSelected = selected === chainId
        return (
          <button
            key={chainId}
            onClick={() => onChange(chainId)}
            style={{
              padding:    '6px 14px',
              borderRadius: 20,
              fontSize:   12,
              fontWeight: 700,
              cursor:     'pointer',
              fontFamily: 'monospace',
              background: isSelected ? chain.color : 'transparent',
              color:      isSelected ? '#000' : chain.color,
              border:     `1px solid ${chain.color}55`,
              transition: 'all 0.15s',
            }}
          >
            {chain.icon} {chain.label}
          </button>
        )
      })}
    </div>
  )
}
