export const THEME_STORAGE_KEY = 'bpsr-checklist:theme'

export type Theme = 'light' | 'dark'

export const isTheme = (value: string | null): value is Theme =>
  value === 'light' || value === 'dark'

export const readStoredTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : null
  } catch {
    return null
  }
}
