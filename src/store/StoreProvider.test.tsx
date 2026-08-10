import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import upstreamTasksDocument from '../data/upstreamTasks.json'
import { addCharacter } from './actions'
import { useStore } from './context'
import {
  BACKUP_STORAGE_KEY,
  RESET_BACKUP_STORAGE_KEY,
  STORAGE_KEY,
} from './persistence'
import {
  RECOVERED_MESSAGE,
  READONLY_MESSAGE,
  RESET_EVALUATION_INTERVAL_MS,
  SAVE_ERROR_MESSAGE,
  StoreProvider,
} from './StoreProvider'

const DAILY_TASK_ID = upstreamTasksDocument.daily[0].id

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

function ResetProbe() {
  const { store, status } = useStore()
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="daily-period-start">
        {store.resetState?.dailyPeriodStart ?? 'none'}
      </p>
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
    // Starts at 1 (the default NoName character injected for a fresh
    // localStorage); stays at 1 because guardedDispatch is a no-op when readonly.
    expect(screen.getByTestId('count')).toHaveTextContent('1')
  })

  it('applies the action and persists the store when not readonly', async () => {
    render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    )

    // Starts at 1 (the default NoName character injected for a fresh
    // localStorage); adding Alice brings it to 2.
    expect(screen.getByTestId('count')).toHaveTextContent('1')
    await userEvent.click(screen.getByRole('button', { name: 'add' }))
    expect(screen.getByTestId('count')).toHaveTextContent('2')
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

describe('StoreProvider / evaluateReset wiring', () => {
  it('registers a visibilitychange listener and an interval timer, and cleans both up on unmount', () => {
    const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener')
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval')

    const { unmount } = render(
      <StoreProvider>
        <Probe />
      </StoreProvider>,
    )

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function),
    )
    expect(clearIntervalSpy).toHaveBeenCalled()
  })

  it('still applies evaluateReset to the displayed store while readonly', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-01T19:59:00.000Z'))
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    render(
      <StoreProvider>
        <ResetProbe />
      </StoreProvider>,
    )

    expect(screen.getByTestId('status')).toHaveTextContent('readonly')
    expect(screen.getByTestId('daily-period-start')).toHaveTextContent(
      '2026-01-31T20:00:00.000Z',
    )

    vi.setSystemTime(new Date('2026-02-01T20:00:01.000Z'))
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(screen.getByTestId('status')).toHaveTextContent('readonly')
    expect(screen.getByTestId('daily-period-start')).toHaveTextContent(
      '2026-02-01T20:00:00.000Z',
    )
  })

  it('applies the reset evaluation once the interval timer fires, without a visibilitychange event', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-01T19:59:00.000Z'))

    render(
      <StoreProvider>
        <ResetProbe />
      </StoreProvider>,
    )

    expect(screen.getByTestId('daily-period-start')).toHaveTextContent(
      '2026-01-31T20:00:00.000Z',
    )

    vi.setSystemTime(new Date('2026-02-01T20:00:01.000Z'))
    act(() => {
      vi.advanceTimersByTime(RESET_EVALUATION_INTERVAL_MS)
    })

    expect(screen.getByTestId('daily-period-start')).toHaveTextContent(
      '2026-02-01T20:00:00.000Z',
    )
  })

  it('does not evaluate a reset on a visibilitychange event while the document is not visible', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-01T19:59:00.000Z'))

    render(
      <StoreProvider>
        <ResetProbe />
      </StoreProvider>,
    )

    expect(screen.getByTestId('daily-period-start')).toHaveTextContent(
      '2026-01-31T20:00:00.000Z',
    )

    vi.setSystemTime(new Date('2026-02-01T20:00:01.000Z'))
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    })
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(screen.getByTestId('daily-period-start')).toHaveTextContent(
      '2026-01-31T20:00:00.000Z',
    )
  })
})

describe('StoreProvider / reset backup wiring', () => {
  it('skips persisting the reset and reports a save error when the reset backup write fails', async () => {
    // No vi.useFakeTimers() here: this test awaits waitFor(), which hangs
    // when fake timers are active. vi.setSystemTime() alone still mocks
    // Date without installing fake timers.
    vi.setSystemTime(new Date('2026-02-04T10:00:00.000Z'))

    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [
        { id: 'char-1', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      progress: { 'char-1': { [DAILY_TASK_ID]: 2 } },
      resetState: {
        dailyPeriodStart: '2026-02-02T20:00:00.000Z',
        weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
      },
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === RESET_BACKUP_STORAGE_KEY) {
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
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
  })
})
