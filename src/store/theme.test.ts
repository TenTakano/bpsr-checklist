import { describe, expect, it, vi } from 'vitest'
import { THEME_STORAGE_KEY, isTheme, readStoredTheme } from './theme'

describe('isTheme', () => {
  it('accepts "light" and "dark"', () => {
    expect(isTheme('light')).toBe(true)
    expect(isTheme('dark')).toBe(true)
  })

  it('rejects any other value', () => {
    expect(isTheme('blue')).toBe(false)
    expect(isTheme(null)).toBe(false)
  })
})

describe('readStoredTheme', () => {
  it('returns the stored theme when a valid value is present', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    expect(readStoredTheme()).toBe('dark')
  })

  it('returns null when nothing is stored', () => {
    expect(readStoredTheme()).toBeNull()
  })

  it('returns null when the stored value is not a valid theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'blue')
    expect(readStoredTheme()).toBeNull()
  })

  it('returns null when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    expect(readStoredTheme()).toBeNull()
  })
})
