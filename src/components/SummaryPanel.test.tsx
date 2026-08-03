import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import upstreamTasksDocument from '../data/upstreamTasks.json'
import { emptyStore, storeWithCharacter } from '../test/fixtures'
import { StoreContext, type StoreContextValue } from '../store/context'
import type { Character } from '../store/schema'
import { SummaryPanel } from './SummaryPanel'

const DAILY_TASK_IDS = upstreamTasksDocument.daily.map((task) => task.id)
const DAILY_TARGET_TASK = upstreamTasksDocument.daily[0]
const DAILY_HIDDEN_TASK_IDS = DAILY_TASK_IDS.filter(
  (id) => id !== DAILY_TARGET_TASK.id,
)
const WEEKLY_HIDDEN_TASK_IDS = upstreamTasksDocument.weekly.map(
  (task) => task.id,
)

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
      <SummaryPanel />
    </StoreContext.Provider>,
  )
  return { dispatch }
}

describe('SummaryPanel / progress bar', () => {
  it('exposes progressbar attributes and the completed/total count for the daily row', () => {
    const character = storeWithCharacter().characters[0]
    renderWithContext({
      store: storeWithCharacter({
        hiddenTaskIds: [...DAILY_HIDDEN_TASK_IDS, ...WEEKLY_HIDDEN_TASK_IDS],
        progress: {
          [character.id]: {
            [DAILY_TARGET_TASK.id]: DAILY_TARGET_TASK.maxProgress,
          },
        },
      }),
    })

    const dailyProgressBar = screen.getByRole('progressbar', {
      name: 'デイリーの全体進捗',
    })
    expect(dailyProgressBar).toHaveAttribute('aria-valuenow', '100')
    expect(dailyProgressBar).toHaveAttribute('aria-valuemin', '0')
    expect(dailyProgressBar).toHaveAttribute('aria-valuemax', '100')
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
  })

  it('shows a 0% progressbar for the weekly row when every weekly task is hidden', () => {
    renderWithContext({
      store: storeWithCharacter({
        hiddenTaskIds: WEEKLY_HIDDEN_TASK_IDS,
      }),
    })

    const weeklyProgressBar = screen.getByRole('progressbar', {
      name: 'ウィークリーの全体進捗',
    })
    expect(weeklyProgressBar).toHaveAttribute('aria-valuenow', '0')
  })
})

describe('SummaryPanel / per-character list', () => {
  it('does not render the per-character list when there are no characters', () => {
    renderWithContext({ store: emptyStore() })

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('resolves each entry to the matching character name', () => {
    const characters: Character[] = [
      { id: 'char-1', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'char-2', name: 'Bob', createdAt: '2026-01-01T00:00:00.000Z' },
    ]
    renderWithContext({
      store: storeWithCharacter({ characters, progress: {} }),
    })

    expect(screen.getAllByText('Alice')).toHaveLength(2)
    expect(screen.getAllByText('Bob')).toHaveLength(2)
  })
})
