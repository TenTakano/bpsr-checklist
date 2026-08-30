import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PROJECT_TASKS_BY_RESET_CYCLE } from '../data/projectTasksResolver'
import {
  emptyStore,
  MONDAY_RESET_STATE,
  storeWithCharacter,
} from '../test/fixtures'
import { StoreContext, type StoreContextValue } from '../store/context'
import type { Character } from '../store/schema'
import { SummaryPanel } from './SummaryPanel'

const DAILY_TASKS = PROJECT_TASKS_BY_RESET_CYCLE.daily
const WEEKLY_TASKS = PROJECT_TASKS_BY_RESET_CYCLE.weekly
const DAILY_TASK_IDS = DAILY_TASKS.map((task) => task.id)
const DAILY_TARGET_TASK = DAILY_TASKS[0]
const DAILY_HIDDEN_TASK_IDS = DAILY_TASK_IDS.filter(
  (id) => id !== DAILY_TARGET_TASK.id,
)
const WEEKLY_HIDDEN_TASK_IDS = WEEKLY_TASKS.map((task) => task.id)

// MONDAY_RESET_STATE (see fixtures.ts) makes these tasks unavailable, so the
// daily denominator drops by however many of them exist in DAILY_TASKS.
const WEEKDAY_UNAVAILABLE_TASK_IDS = ['guild_hunt', 'guild_dance']
const WEEKDAY_UNAVAILABLE_TASK_COUNT = DAILY_TASKS.filter((task) =>
  WEEKDAY_UNAVAILABLE_TASK_IDS.includes(task.id),
).length
if (WEEKDAY_UNAVAILABLE_TASK_COUNT !== WEEKDAY_UNAVAILABLE_TASK_IDS.length) {
  throw new Error(
    'guild_hunt/guild_dance must exist in DAILY_TASKS for weekday-limited task tests',
  )
}

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

  it('excludes weekday-unavailable tasks from the daily denominator', () => {
    renderWithContext({
      store: storeWithCharacter({ resetState: MONDAY_RESET_STATE }),
    })

    expect(
      screen.getByText(
        `0 / ${DAILY_TASK_IDS.length - WEEKDAY_UNAVAILABLE_TASK_COUNT}`,
      ),
    ).toBeInTheDocument()
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
