import { useCallback, useEffect, useState } from 'react'
import { readStoredTheme, THEME_STORAGE_KEY, type Theme } from '../store/theme'

const readSystemTheme = (): Theme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const readInitialTheme = (): Theme => readStoredTheme() ?? readSystemTheme()

const applyTheme = (theme: Theme): void => {
  document.documentElement.dataset.theme = theme
}

const persistTheme = (theme: Theme): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    return
  }
}

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(readInitialTheme)
  const [hasManualOverride, setHasManualOverride] = useState<boolean>(
    () => readStoredTheme() !== null,
  )

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (hasManualOverride) {
      return
    }
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? 'dark' : 'light')
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [hasManualOverride])

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === 'dark' ? 'light' : 'dark'
      persistTheme(next)
      return next
    })
    setHasManualOverride(true)
  }, [])

  return { theme, toggleTheme }
}
