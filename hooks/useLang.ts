'use client'
import { useState, useEffect, useCallback } from 'react'
import { LangCode, TRANSLATIONS, RTL_LANGS, LANG_META, T } from '../app/lib/translations'

const STORAGE_KEY = 'sq_lang'

export function useLang() {
  const [lang, setLangState] = useState<LangCode>('EN')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as LangCode | null
      if (stored && TRANSLATIONS[stored]) setLangState(stored)
    } catch {}
    setMounted(true)
  }, [])

  const setLang = useCallback((l: LangCode) => {
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch {}
    // update dir for RTL languages
    if (typeof document !== 'undefined') {
      document.documentElement.dir = RTL_LANGS.includes(l) ? 'rtl' : 'ltr'
      document.documentElement.lang = l.toLowerCase()
    }
  }, [])

  const t: T = TRANSLATIONS[lang]
  const meta = LANG_META[lang]
  const isRTL = RTL_LANGS.includes(lang)

  return { lang, setLang, t, meta, isRTL, mounted }
}
