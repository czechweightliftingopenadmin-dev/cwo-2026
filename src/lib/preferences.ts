export type Theme = 'dark' | 'light'
export type Language = 'cs' | 'en'

export const preferenceKeys = { theme: 'cwo:theme', language: 'cwo:language' } as const

export function readPreference(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function savePreference(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Preferences still work for this visit when browser storage is disabled.
  }
}

export function getLanguage(): Language {
  return readPreference(preferenceKeys.language) === 'en' ? 'en' : 'cs'
}

export function getTheme(): Theme {
  return readPreference(preferenceKeys.theme) === 'light' ? 'light' : 'dark'
}
