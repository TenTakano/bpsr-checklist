import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addCharacter } from './actions'
import { useStore } from './context'
import { BACKUP_STORAGE_KEY, STORAGE_KEY } from './persistence'
import {
  RECOVERED_MESSAGE,
  READONLY_MESSAGE,
  SAVE_ERROR_MESSAGE,
  StoreProvider,
} from './StoreProvider'

function Probe() {
  const { store, status, message, dispatch } = useStore()
  return (
    <div>
      <p data-testid="status">{status}</p>
      {message !== null && <p role="status">{message}</p>}
      <p data-testid="count">{store.characters.length}</p>
      <button onClick={() => dispatch(addCharacter('Alice'))}>add</button>
    </div>
  )
}

describe('StoreProvider / resolveInitialState', () => {
  it('starts with status ok and no message when localStorage is empty', () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    )
    expect(screen.getByTestId('status')).toHaveTextContent('ok')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('starts with status recovered and the recovered message when stored data is corrupt', async () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')

    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    )

    expect(screen.getByTestId('status')).toHaveTextContent('recovered')
    expect(await screen.findByRole('status')).toHaveTextContent(
      RECOVERED_MESSAGE,
    )
  })

  it('starts with status readonly and the readonly message when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    )

    expect(screen.getByTestId('status')).toHaveTextContent('readonly')
    expect(screen.getByRole('status')).toHaveTextContent(READONLY_MESSAGE)
  })
})

describe('StoreProvider / backup failure', () => {
  it('falls back to readonly with the readonly message when backing up corrupted data fails', async () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')

    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === BACKUP_STORAGE_KEY) {
        throw new Error('QuotaExceededError')
      }
      originalSetItem.call(this, key, value)
    })

    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('readonly')
    })
    expect(screen.getByRole('status')).toHaveTextContent(READONLY_MESSAGE)
  })
})

describe('StoreProvider / guardedDispatch', () => {
  it('is a no-op and leaves the store unchanged when readonly', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'add' }))
    expect(screen.getByTestId('count')).toHaveTextContent('0')
  })

  it('applies the action and persists the store when not readonly', async () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'add' }))
    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })
})

describe('StoreProvider / save error priority', () => {
  it('shows the save error message in place of the initial recovered message when saving fails', async () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')

    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === STORAGE_KEY) {
        throw new Error('QuotaExceededError')
      }
      originalSetItem.call(this, key, value)
    })

    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    )

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(SAVE_ERROR_MESSAGE)
    })
    expect(screen.getByRole('status')).not.toHaveTextContent(RECOVERED_MESSAGE)
  })
})
