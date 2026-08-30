import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { emptyStore } from '../test/fixtures'
import { StoreContext, type StoreContextValue } from '../store/context'
import { SettingsModal } from './SettingsModal'

const renderWithContext = (
  props: Parameters<typeof SettingsModal>[0],
  overrides: Partial<StoreContextValue> = {},
) => {
  const value: StoreContextValue = {
    store: emptyStore(),
    status: 'ok',
    message: null,
    dispatch: vi.fn(),
    ...overrides,
  }
  render(
    <StoreContext.Provider value={value}>
      <SettingsModal {...props} />
    </StoreContext.Provider>,
  )
}

describe('SettingsModal / initial focus', () => {
  it('focuses the matching task-visibility section heading when initialFocusSection targets an existing section', () => {
    renderWithContext({ onClose: vi.fn(), initialFocusSection: 'daily' })
    expect(
      within(screen.getByRole('dialog')).getByRole('heading', {
        name: 'デイリー',
        level: 4,
      }),
    ).toHaveFocus()
  })

  it('falls back to the character name input when initialFocusSection has no matching section (e.g. milestone)', () => {
    renderWithContext({ onClose: vi.fn(), initialFocusSection: 'milestone' })
    expect(screen.getByLabelText('キャラクター名')).toHaveFocus()
  })

  it('focuses the character name input when initialFocusSection is not provided', () => {
    renderWithContext({ onClose: vi.fn() })
    expect(screen.getByLabelText('キャラクター名')).toHaveFocus()
  })
})
