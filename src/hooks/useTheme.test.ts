import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { THEME_STORAGE_KEY, useTheme } from './useTheme'

describe('useTheme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  it('保存されたテーマが無い場合はシステム設定を初期値にする', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('localStorage に保存された値を初期値として優先する', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('dark')
  })

  it('toggleTheme で data-theme と localStorage を更新する', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('light')

    act(() => {
      result.current.toggleTheme()
    })

    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('手動切替前はシステム設定の変更に追従する', async () => {
    let changeHandler: ((event: MediaQueryListEvent) => void) | undefined
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: (
        _event: string,
        handler: (event: MediaQueryListEvent) => void,
      ) => {
        changeHandler = handler
      },
      removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia

    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')

    act(() => {
      changeHandler?.({ matches: true } as MediaQueryListEvent)
    })

    await waitFor(() => expect(result.current.theme).toBe('dark'))
  })

  it('手動切替後はシステム設定の変更を無視する', () => {
    let changeHandler: ((event: MediaQueryListEvent) => void) | undefined
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: (
        _event: string,
        handler: (event: MediaQueryListEvent) => void,
      ) => {
        changeHandler = handler
      },
      removeEventListener: () => {
        changeHandler = undefined
      },
    })) as unknown as typeof window.matchMedia

    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.toggleTheme()
    })
    expect(result.current.theme).toBe('dark')

    act(() => {
      changeHandler?.({ matches: false } as MediaQueryListEvent)
    })

    expect(result.current.theme).toBe('dark')
  })
})
