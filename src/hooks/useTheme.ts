import { useEffect, useState } from 'react'
import { getTheme, preferenceKeys, savePreference } from '../lib/preferences'
import type { Theme } from '../lib/preferences'

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#101011' : '#f7f5ef')
    savePreference(preferenceKeys.theme, theme)
  }, [theme])

  return { theme, setTheme }
}
