import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import upstreamTasksDocument from '../data/upstreamTasks.json'
import { getTaskLabel } from '../data/taskLabel'
import {
  DEFAULT_CHARACTER,
  emptyStore,
  storeWithCharacter,
} from '../test/fixtures'
import { moveTask, setProgress } from '../store/actions'
import { StoreContext, type StoreContextValue } from '../store/context'
import type { Character } from '../store/schema'
import { NO_CHARACTERS_MESSAGE, NO_VISIBLE_TASKS_MESSAGE } from './messages'
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

// jsdom has no DataTransfer constructor, so drag-and-drop tests build a
// minimal stand-in with just the members the component reads/writes.
const fakeDataTransfer = () => {
  const data: Record<string, string> = {}
  return {
    effectAllowed: '',
    dropEffect: '',
    setData: (format: string, value: string) => {
      data[format] = value
    },
    getData: (format: string) => data[format] ?? '',
  }
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
    expect(button).toHaveClass('matrix-toggle--done')
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

  it('disables the increment button and marks the value complete once it reaches maxProgress', () => {
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
    const valueDisplay = screen.getByText(
      `${COUNTER_TASK_MAX}/${COUNTER_TASK_MAX}`,
    )
    expect(valueDisplay).toHaveClass('matrix-counter-value--complete')
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

describe('MatrixView / task order buttons', () => {
  const firstLabel = getTaskLabel(upstreamTasksDocument.daily[0])
  const lastDailyTask =
    upstreamTasksDocument.daily[upstreamTasksDocument.daily.length - 1]
  const lastLabel = getTaskLabel(lastDailyTask)

  it('disables the up button on the first row and the down button on the last row', () => {
    renderWithContext({ store: storeWithCharacter() })
    expect(
      screen.getByRole('button', { name: `${firstLabel} を上に移動` }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: `${firstLabel} を下に移動` }),
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: `${lastLabel} を下に移動` }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: `${lastLabel} を上に移動` }),
    ).toBeEnabled()
  })

  it('dispatches moveTask with the taskOrder-array index when the down button is clicked', async () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    const button = screen.getByRole('button', {
      name: `${firstLabel} を下に移動`,
    })
    await userEvent.click(button)
    expect(dispatch).toHaveBeenCalledWith(moveTask('daily', TOGGLE_TASK_ID, 1))
  })

  it('dispatches moveTask when the up button is clicked', async () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    const button = screen.getByRole('button', {
      name: `${lastLabel} を上に移動`,
    })
    await userEvent.click(button)
    expect(dispatch).toHaveBeenCalledWith(
      moveTask(
        'daily',
        lastDailyTask.id,
        upstreamTasksDocument.daily.length - 2,
      ),
    )
  })
})

describe('MatrixView / drag and drop reordering', () => {
  it('dispatches moveTask with the drop target index when a row is dragged within the same section', () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    const source = screen.getByTitle(
      getTaskLabel(upstreamTasksDocument.daily[0]),
    )
    const target = screen.getByTitle(
      getTaskLabel(upstreamTasksDocument.daily[2]),
    )
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.dragOver(target, { dataTransfer })
    fireEvent.drop(target, { dataTransfer })

    expect(dispatch).toHaveBeenCalledWith(moveTask('daily', TOGGLE_TASK_ID, 2))
  })

  it('ignores a drop when the dragged row belongs to a different section', () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    const dailySource = screen.getByTitle(
      getTaskLabel(upstreamTasksDocument.daily[0]),
    )
    const weeklyTarget = screen.getByTitle(
      getTaskLabel(upstreamTasksDocument.weekly[0]),
    )
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(dailySource, { dataTransfer })
    fireEvent.drop(weeklyTarget, { dataTransfer })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('does not dispatch when dropping a row onto itself', () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    const source = screen.getByTitle(
      getTaskLabel(upstreamTasksDocument.daily[0]),
    )
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.drop(source, { dataTransfer })

    expect(dispatch).not.toHaveBeenCalled()
  })
})

describe('MatrixView / hidden tasks', () => {
  it('excludes a hidden task row from rendering while keeping other rows', () => {
    renderWithContext({
      store: storeWithCharacter({ hiddenTaskIds: [TOGGLE_TASK_ID] }),
    })
    expect(
      screen.queryByTitle(getTaskLabel(upstreamTasksDocument.daily[0])),
    ).not.toBeInTheDocument()
    expect(
      screen.getByTitle(getTaskLabel(upstreamTasksDocument.daily[1])),
    ).toBeInTheDocument()
  })

  it('shows an empty-state message for a section when every task in it is hidden', () => {
    const allDailyIds = upstreamTasksDocument.daily.map((task) => task.id)
    renderWithContext({
      store: storeWithCharacter({ hiddenTaskIds: allDailyIds }),
    })
    expect(screen.getByText(NO_VISIBLE_TASKS_MESSAGE)).toBeInTheDocument()
    expect(screen.getAllByRole('rowheader')).toHaveLength(
      upstreamTasksDocument.weekly.length,
    )
  })

  it('keeps the ↑/↓ move target anchored to the full taskOrder position even when a hidden task sits between visible rows', async () => {
    const dailyIds = upstreamTasksDocument.daily.map((task) => task.id)
    const { dispatch } = renderWithContext({
      store: storeWithCharacter({ hiddenTaskIds: [dailyIds[1]] }),
    })
    const thirdLabel = getTaskLabel(upstreamTasksDocument.daily[2])
    const button = screen.getByRole('button', {
      name: `${thirdLabel} を上に移動`,
    })
    await userEvent.click(button)
    expect(dispatch).toHaveBeenCalledWith(moveTask('daily', dailyIds[2], 1))
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

  it('disables the drag handle on every task row', () => {
    renderWithContext({
      store: storeWithCharacter(),
      status: 'readonly',
    })
    const rowHeaders = screen.getAllByRole('rowheader')
    expect(rowHeaders.length).toBeGreaterThan(0)
    for (const rowHeader of rowHeaders) {
      expect(rowHeader).toHaveAttribute('draggable', 'false')
    }
  })
})
