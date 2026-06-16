'use client'
import { useState } from 'react'
import { LangCode, LANG_META } from '../app/lib/translations'

interface Props {
  lang: LangCode
  onChange: (l: LangCode) => void
  mono?: boolean
}

const REGIONS = ['Global', 'Africa', 'Asia', 'Europe', 'Americas'] as const

export default function LangPicker({ lang, onChange, mono }: Props) {
  const [open, setOpen] = useState(false)
  const meta = LANG_META[lang]
  const font = mono ? "'JetBrains Mono','Fira Code','Courier New',monospace" : 'inherit'

  const grouped: Record<string, LangCode[]> = {}
  for (const region of REGIONS) grouped[region] = []
  for (const [code, m] of Object.entries(LANG_META) as [LangCode, typeof LANG_META[LangCode]][]) {
    grouped[m.region]?.push(code)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontFamily: font, cursor: 'pointer', background: open ? 'rgba(153,69,255,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(153,69,255,0.3)', color: '#9945FF', display: 'flex', alignItems: 'center', gap: 5 }}
      >
        {meta.flag} {lang} ▾
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 100, background: '#0a0014', border: '1px solid rgba(153,69,255,0.3)', borderRadius: 10, padding: 10, width: 280, maxHeight: 360, overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
            {REGIONS.map(region => {
              const codes = grouped[region]
              if (!codes?.length) return null
              return (
                <div key={region}>
                  <div style={{ fontSize: 9, color: '#555', letterSpacing: '0.12em', padding: '6px 6px 3px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 4 }}>{region.toUpperCase()}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
                    {codes.map(code => {
                      const m = LANG_META[code]
                      const isActive = code === lang
                      return (
                        <button
                          key={code}
                          onClick={() => { onChange(code); setOpen(false) }}
                          title={m.name}
                          style={{ padding: '4px 7px', borderRadius: 5, fontSize: 10, fontFamily: font, cursor: 'pointer', background: isActive ? '#9945FF' : 'transparent', color: isActive ? '#fff' : '#aaa', border: `1px solid ${isActive ? '#9945FF' : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', gap: 3 }}
                          onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'rgba(153,69,255,0.15)'; (e.currentTarget as HTMLElement).style.color = '#9945FF' } }}
                          onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#aaa' } }}
                        >
                          {m.flag} {code}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
