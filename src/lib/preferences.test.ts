import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getLanguage,
  getTheme,
  preferenceKeys,
  readPreference,
  savePreference,
} from './preferences'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('preferences', () => {
  it('defaults to Czech and dark for missing or invalid preferences', () => {
    expect(getLanguage()).toBe('cs')
    expect(getTheme()).toBe('dark')
    savePreference(preferenceKeys.language, 'unsupported')
    savePreference(preferenceKeys.theme, 'unsupported')
    expect(getLanguage()).toBe('cs')
    expect(getTheme()).toBe('dark')
  })

  it('restores saved preferences', () => {
    savePreference(preferenceKeys.language, 'en')
    savePreference(preferenceKeys.theme, 'light')
    expect(getLanguage()).toBe('en')
    expect(getTheme()).toBe('light')
  })

  it('works when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage disabled')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage disabled')
    })
    expect(readPreference(preferenceKeys.theme)).toBeNull()
    expect(() => savePreference(preferenceKeys.theme, 'light')).not.toThrow()
    expect(getTheme()).toBe('dark')
    expect(getLanguage()).toBe('cs')
  })
})
