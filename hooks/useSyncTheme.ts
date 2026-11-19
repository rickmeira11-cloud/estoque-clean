'use client'
import { useEffect, useState } from 'react'

export function useSyncTheme(): 'dark' | 'light' {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof document === 'undefined') return 'dark'
    return (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark'
  })

  useEffect(() => {
    const obs = new MutationObserver(() => {
      const t = document.documentElement.getAttribute('data-theme') as 'dark' | 'light'
      setTheme(t || 'dark')
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  return theme
}
