import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import upstreamTasksDocument from '../data/upstreamTasks.json'
import { getTaskLabel } from '../data/taskLabel'
import {
  DEFAULT_CHARACTER,
  emptyStore,
  storeWithCharacter,
} from '../test/fixtures'
import { setProgress } from '../store/actions'
import { StoreContext, type StoreContextValue } from '../store/context'
import type { Character } from '../store/schema'
import { NO_CHARACTERS_MESSAGE } from './messages'
import { MatrixView } from './MatrixView'

const TOGGLE_TASK_ID = upstreamTasksDocument.daily[0].id
if (upstreamTasksDocument.daily[0].maxProgress !== 1) {
  throw new Error(
    'upstreamTasksDocument.daily[0] must have maxProgress 1 for these tests',
  )
}

const COUNTER_TASK_ID = upstreamTasksDocument.daily[2].id
const COUNTER_TASK_LABEL = getTaskLabel(upstreamTasksDocument.daily[2])
const COUNTER_TASK_MAX = upstreamTasksDocument.daily[2].maxProgress
if (COUNTER_TASK_MAX <= 1) {
  throw new Error(
    'upstreamTasksDocument.daily[2] must have maxProgress > 1 for these tests',
  )
}

const OPTIONAL_TASK = upstreamTasksDocument.daily.find((task) => task.optional)
if (!OPTIONAL_TASK) {
  throw new Error(
    'upstreamTasksDocument.daily must contain at least one optional task for this test',
  )
}

const CHARACTER_NAME = DEFAULT_CHARACTER.name
const CHARACTER_ID = DEFAULT_CHARACTER.id

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
      <MatrixView />
    </StoreContext.Provider>,
  )
  return { dispatch }
}

const secondCharacter: Character = {
  id: 'char-2',
  name: 'Bob',
  createdAt: '2026-01-02T00:00:00.000Z',
}

describe('MatrixView / empty state', () => {
  it('shows an empty-state message and no table when there are no characters', () => {
    renderWithContext()
    expect(screen.getByText(NO_CHARACTERS_MESSAGE)).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('MatrixView / rendering scale', () => {
  it('renders one row per daily/weekly task (36 total) across both sections', () => {
    renderWithContext({ store: storeWithCharacter() })
    const totalTaskCount =
      upstreamTasksDocument.daily.length + upstreamTasksDocument.weekly.length
    expect(screen.getAllByRole('rowheader')).toHaveLength(totalTaskCount)
  })

  it('renders a column per character', () => {
    const store = storeWithCharacter({
      characters: [DEFAULT_CHARACTER, secondCharacter],
    })
    renderWithContext({ store })
    expect(
      screen.getByRole('button', {
        name: `${CHARACTER_NAME} ${getTaskLabel(upstreamTasksDocument.daily[0])}`,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: `${secondCharacter.name} ${getTaskLabel(upstreamTasksDocument.daily[0])}`,
      }),
    ).toBeInTheDocument()
  })
})

describe('MatrixView / toggle cells (maxProgress = 1)', () => {
  it('dispatches setProgress with 1 when an unset toggle cell is clicked', async () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    const button = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${getTaskLabel(upstreamTasksDocument.daily[0])}`,
    })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(dispatch).toHaveBeenCalledWith(
      setProgress(CHARACTER_ID, TOGGLE_TASK_ID, 1),
    )
  })

  it('dispatches setProgress with 0 when a completed toggle cell is clicked', async () => {
    const { dispatch } = renderWithContext({
      store: storeWithCharacter({
        progress: { [CHARACTER_ID]: { [TOGGLE_TASK_ID]: 1 } },
      }),
    })
    const button = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${getTaskLabel(upstreamTasksDocument.daily[0])}`,
    })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(button)
    expect(dispatch).toHaveBeenCalledWith(
      setProgress(CHARACTER_ID, TOGGLE_TASK_ID, 0),
    )
  })
})

describe('MatrixView / counter cells (maxProgress > 1)', () => {
  it('disables the decrement button and dispatches setProgress on increment when the value is 0', async () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    const decrement = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${COUNTER_TASK_LABEL} を減らす`,
    })
    const increment = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${COUNTER_TASK_LABEL} を増やす`,
    })
    expect(decrement).toBeDisabled()
    expect(increment).toBeEnabled()
    await userEvent.click(increment)
    expect(dispatch).toHaveBeenCalledWith(
      setProgress(CHARACTER_ID, COUNTER_TASK_ID, 1),
    )
  })

  it('disables the increment button once the value reaches maxProgress', () => {
    renderWithContext({
      store: storeWithCharacter({
        progress: { [CHARACTER_ID]: { [COUNTER_TASK_ID]: COUNTER_TASK_MAX } },
      }),
    })
    const increment = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${COUNTER_TASK_LABEL} を増やす`,
    })
    const decrement = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${COUNTER_TASK_LABEL} を減らす`,
    })
    expect(increment).toBeDisabled()
    expect(decrement).toBeEnabled()
    expect(
      screen.getByText(`${COUNTER_TASK_MAX}/${COUNTER_TASK_MAX}`),
    ).toBeInTheDocument()
  })

  it('shows an over-max indicator and keeps increment disabled when upstream shrank below the stored value', () => {
    const overValue = COUNTER_TASK_MAX + 1
    renderWithContext({
      store: storeWithCharacter({
        progress: { [CHARACTER_ID]: { [COUNTER_TASK_ID]: overValue } },
      }),
    })
    const valueDisplay = screen.getByText(`${overValue}/${COUNTER_TASK_MAX}`)
    expect(valueDisplay).toHaveClass('matrix-counter-value--over')
    expect(
      screen.getByRole('button', {
        name: `${CHARACTER_NAME} ${COUNTER_TASK_LABEL} を増やす`,
      }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', {
        name: `${CHARACTER_NAME} ${COUNTER_TASK_LABEL} を減らす`,
      }),
    ).toBeEnabled()
  })
})

describe('MatrixView / optional tasks', () => {
  it('marks optional task rows with a thin-display class and badge', () => {
    renderWithContext({ store: storeWithCharacter() })
    const row = screen.getByTitle(getTaskLabel(OPTIONAL_TASK)).closest('tr')
    expect(row).toHaveClass('matrix-row--optional')
    expect(screen.getAllByText('任意').length).toBeGreaterThan(0)
  })
})

describe('MatrixView / readonly mode', () => {
  it('disables every toggle and counter control', () => {
    renderWithContext({
      store: storeWithCharacter(),
      status: 'readonly',
    })
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button).toBeDisabled()
    }
  })
})
