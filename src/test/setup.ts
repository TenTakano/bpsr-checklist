import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

const createMatchMedia = (matches: boolean): typeof window.matchMedia =>
  vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))

beforeEach(() => {
  localStorage.clear()
  window.matchMedia = createMatchMedia(false)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
