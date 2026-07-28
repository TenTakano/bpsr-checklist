import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { emptyStore, storeWithCharacter } from '../test/fixtures'
import {
  addCharacter,
  duplicateCharacter,
  removeCharacter,
  renameCharacter,
} from '../store/actions'
import { StoreContext, type StoreContextValue } from '../store/context'
import { CharacterManager } from './CharacterManager'

const renderWithContext = (overrides: Partial<StoreContextValue> = {}) => {
  const dispatch = vi.fn()
  const value: StoreContextValue = {
    store: emptyStore(),
    status: 'ok',
    message: null,
    dispatch,
    ...overrides,
  }
  render(
    <StoreContext.Provider value={value}>
      <CharacterManager />
    </StoreContext.Provider>,
  )
  return { dispatch }
}

describe('CharacterManager / add form', () => {
  it('does not add a character when the name is blank or whitespace-only', async () => {
    const { dispatch } = renderWithContext()
    await userEvent.type(screen.getByLabelText('キャラクター名'), '   ')
    await userEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('dispatches addCharacter when the name is valid', async () => {
    const { dispatch } = renderWithContext()
    await userEvent.type(screen.getByLabelText('キャラクター名'), 'Alice')
    await userEvent.click(screen.getByRole('button', { name: '追加' }))
    expect(dispatch).toHaveBeenCalledWith(addCharacter('Alice'))
    expect(screen.getByLabelText('キャラクター名')).toHaveValue('')
  })

  it('renders an existing character supplied by the store', () => {
    renderWithContext({ store: storeWithCharacter() })
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
})

describe('CharacterManager / readonly mode', () => {
  it('disables all interactive controls when the store is readonly', () => {
    renderWithContext({ store: storeWithCharacter(), status: 'readonly' })
    expect(screen.getByLabelText('キャラクター名')).toBeDisabled()
    expect(screen.getByRole('button', { name: '追加' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'リネーム' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '複製' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '削除' })).toBeDisabled()
  })
})

describe('CharacterManager / duplicate', () => {
  it('dispatches duplicateCharacter when 複製 is clicked', async () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    await userEvent.click(screen.getByRole('button', { name: '複製' }))
    expect(dispatch).toHaveBeenCalledWith(duplicateCharacter('char-1'))
  })
})

describe('CharacterManager / delete confirmation', () => {
  it('does not dispatch removeCharacter when the confirm dialog is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    await userEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('dispatches removeCharacter when the confirm dialog is accepted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    await userEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(dispatch).toHaveBeenCalledWith(removeCharacter('char-1'))
  })
})

describe('CharacterManager / rename transitions', () => {
  it('opens a rename form pre-filled with the current name when リネーム is clicked', async () => {
    renderWithContext({ store: storeWithCharacter() })
    await userEvent.click(screen.getByRole('button', { name: 'リネーム' }))
    expect(screen.getByLabelText('Alice の新しい名前')).toHaveValue('Alice')
  })

  it('closes the rename form without dispatching when キャンセル is clicked', async () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    await userEvent.click(screen.getByRole('button', { name: 'リネーム' }))
    await userEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(dispatch).not.toHaveBeenCalled()
    expect(
      screen.queryByLabelText('Alice の新しい名前'),
    ).not.toBeInTheDocument()
  })

  it('dispatches renameCharacter and closes the form when 保存 is clicked', async () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    await userEvent.click(screen.getByRole('button', { name: 'リネーム' }))
    const input = screen.getByLabelText('Alice の新しい名前')
    await userEvent.clear(input)
    await userEvent.type(input, 'Bob')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(dispatch).toHaveBeenCalledWith(renameCharacter('char-1', 'Bob'))
    expect(
      screen.queryByLabelText('Alice の新しい名前'),
    ).not.toBeInTheDocument()
  })

  it('does not dispatch renameCharacter when the new name is whitespace-only', async () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    await userEvent.click(screen.getByRole('button', { name: 'リネーム' }))
    const input = screen.getByLabelText('Alice の新しい名前')
    await userEvent.clear(input)
    await userEvent.type(input, '   ')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(dispatch).not.toHaveBeenCalled()
  })
})
