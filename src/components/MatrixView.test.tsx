import { describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DAILY_TASKS, WEEKLY_TASKS } from '../data/projectTasksResolver'
import { getTaskLabel, splitTaskLabel } from '../data/taskLabel'
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

const TOGGLE_TASK_ID = DAILY_TASKS[0].id
if (DAILY_TASKS[0].maxProgress !== 1) {
  throw new Error('DAILY_TASKS[0] must have maxProgress 1 for these tests')
}

const COUNTER_TASK_ID = DAILY_TASKS[2].id
const COUNTER_TASK_LABEL = getTaskLabel(DAILY_TASKS[2])
const COUNTER_TASK_MAX = DAILY_TASKS[2].maxProgress
if (COUNTER_TASK_MAX <= 1) {
  throw new Error('DAILY_TASKS[2] must have maxProgress > 1 for these tests')
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
  const onOpenTaskVisibility = vi.fn()
  render(
    <StoreContext.Provider value={value}>
      <MatrixView onOpenTaskVisibility={onOpenTaskVisibility} />
    </StoreContext.Provider>,
  )
  return { dispatch, onOpenTaskVisibility }
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

// Rows where every displayed character has completed the task move into the
// collapsed "完了済み" accordion group, so tests that expect such a row's
// cells to already be in the DOM must open the group first.
const openCompletedGroup = async () => {
  await userEvent.click(screen.getByRole('button', { name: /^完了済み/ }))
}

// The task-label `th` doesn't expose the row directly, so tests that need
// the `tr` (for drag handles or row-level class assertions) locate it via
// the task-label's `title`.
const getRowByLabel = (label: string) => {
  const row = screen.getByTitle(label).closest('tr')
  if (row === null) {
    throw new Error(`row not found for label: ${label}`)
  }
  return row
}

// Drag origin lives on the handle button in the row's leftmost cell, not on
// the task-label `th` itself.
const getDragHandle = (label: string) => {
  const row = getRowByLabel(label)
  return within(row).getByRole('button', {
    name: `${label} をドラッグして並べ替え`,
  })
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
    const totalTaskCount = DAILY_TASKS.length + WEEKLY_TASKS.length
    expect(screen.getAllByRole('rowheader')).toHaveLength(totalTaskCount)
  })

  it('renders a column per character', () => {
    const store = storeWithCharacter({
      characters: [DEFAULT_CHARACTER, secondCharacter],
    })
    renderWithContext({ store })
    expect(
      screen.getByRole('button', {
        name: `${CHARACTER_NAME} ${getTaskLabel(DAILY_TASKS[0])}`,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: `${secondCharacter.name} ${getTaskLabel(DAILY_TASKS[0])}`,
      }),
    ).toBeInTheDocument()
  })
})

describe('MatrixView / toggle cells (maxProgress = 1)', () => {
  it('dispatches setProgress with 1 when an unset toggle cell is clicked', async () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    const button = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${getTaskLabel(DAILY_TASKS[0])}`,
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
    await openCompletedGroup()
    const button = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${getTaskLabel(DAILY_TASKS[0])}`,
    })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveClass('matrix-toggle--done')
    await userEvent.click(button)
    expect(dispatch).toHaveBeenCalledWith(
      setProgress(CHARACTER_ID, TOGGLE_TASK_ID, 0),
    )
  })
})

describe('MatrixView / checkbox cells (maxProgress > 1, default)', () => {
  it('dispatches setProgress with maxProgress when an unchecked cell is clicked', async () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    const checkbox = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${COUNTER_TASK_LABEL}`,
    })
    expect(checkbox).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(checkbox)
    expect(dispatch).toHaveBeenCalledWith(
      setProgress(CHARACTER_ID, COUNTER_TASK_ID, COUNTER_TASK_MAX),
    )
  })

  it('dispatches setProgress with 0 when a completed cell is clicked', async () => {
    const { dispatch } = renderWithContext({
      store: storeWithCharacter({
        progress: { [CHARACTER_ID]: { [COUNTER_TASK_ID]: COUNTER_TASK_MAX } },
      }),
    })
    await openCompletedGroup()
    const checkbox = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${COUNTER_TASK_LABEL}`,
    })
    expect(checkbox).toHaveAttribute('aria-pressed', 'true')
    expect(checkbox).toHaveClass('matrix-toggle--done')
    await userEvent.click(checkbox)
    expect(dispatch).toHaveBeenCalledWith(
      setProgress(CHARACTER_ID, COUNTER_TASK_ID, 0),
    )
  })

  it('shows a checked cell when the stored value exceeds maxProgress', async () => {
    renderWithContext({
      store: storeWithCharacter({
        progress: {
          [CHARACTER_ID]: { [COUNTER_TASK_ID]: COUNTER_TASK_MAX + 1 },
        },
      }),
    })
    await openCompletedGroup()
    const checkbox = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${COUNTER_TASK_LABEL}`,
    })
    expect(checkbox).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('MatrixView / detailed counter cells (maxProgress > 1, detailedCountTaskIds)', () => {
  it('disables the decrement button and dispatches setProgress on increment when the value is 0', async () => {
    const { dispatch } = renderWithContext({
      store: storeWithCharacter({
        detailedCountTaskIds: [COUNTER_TASK_ID],
      }),
    })
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

  it('disables the increment button and marks the value complete once it reaches maxProgress', async () => {
    renderWithContext({
      store: storeWithCharacter({
        detailedCountTaskIds: [COUNTER_TASK_ID],
        progress: { [CHARACTER_ID]: { [COUNTER_TASK_ID]: COUNTER_TASK_MAX } },
      }),
    })
    await openCompletedGroup()
    const increment = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${COUNTER_TASK_LABEL} を増やす`,
    })
    const decrement = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${COUNTER_TASK_LABEL} を減らす`,
    })
    expect(increment).toBeDisabled()
    expect(decrement).toBeEnabled()
    expect(increment).toHaveTextContent(
      `${COUNTER_TASK_MAX}/${COUNTER_TASK_MAX}`,
    )
    expect(increment).toHaveClass('matrix-counter-increment--complete')
  })

  it('shows an over-max indicator and keeps increment disabled when upstream shrank below the stored value', async () => {
    const overValue = COUNTER_TASK_MAX + 1
    renderWithContext({
      store: storeWithCharacter({
        detailedCountTaskIds: [COUNTER_TASK_ID],
        progress: { [CHARACTER_ID]: { [COUNTER_TASK_ID]: overValue } },
      }),
    })
    await openCompletedGroup()
    const increment = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${COUNTER_TASK_LABEL} を増やす`,
    })
    const decrement = screen.getByRole('button', {
      name: `${CHARACTER_NAME} ${COUNTER_TASK_LABEL} を減らす`,
    })
    expect(increment).toHaveTextContent(`${overValue}/${COUNTER_TASK_MAX}`)
    expect(increment).toHaveClass('matrix-counter-increment--over')
    expect(increment).toBeDisabled()
    expect(decrement).toBeEnabled()
  })
})

describe('MatrixView / drag and drop reordering', () => {
  it('dispatches moveTask with the drop target index when a row is dragged within the same section', () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    const source = getDragHandle(getTaskLabel(DAILY_TASKS[0]))
    const target = screen.getByTitle(getTaskLabel(DAILY_TASKS[2]))
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.dragOver(target, { dataTransfer })
    fireEvent.drop(target, { dataTransfer })

    expect(dispatch).toHaveBeenCalledWith(moveTask('daily', TOGGLE_TASK_ID, 2))
  })

  it('ignores a drop when the dragged row belongs to a different section', () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    const dailySource = getDragHandle(getTaskLabel(DAILY_TASKS[0]))
    const weeklyTarget = screen.getByTitle(getTaskLabel(WEEKLY_TASKS[0]))
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(dailySource, { dataTransfer })
    fireEvent.drop(weeklyTarget, { dataTransfer })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('does not dispatch when dropping a row onto itself', () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    const label = getTaskLabel(DAILY_TASKS[0])
    const source = getDragHandle(label)
    const target = screen.getByTitle(label)
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.drop(target, { dataTransfer })

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('adds matrix-row--dragging to the row being dragged', () => {
    renderWithContext({ store: storeWithCharacter() })
    const label = getTaskLabel(DAILY_TASKS[0])
    const source = getDragHandle(label)
    const row = getRowByLabel(label)
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(source, { dataTransfer })

    expect(row).toHaveClass('matrix-row--dragging')
  })
})

describe('MatrixView / drag insertion indicator direction', () => {
  it.each([
    {
      name: 'shows a below-indicator on the drop target row when dragging downward',
      sourceIndex: 0,
      targetIndex: 2,
      expectedClass: 'matrix-row--drag-over-below',
      unexpectedClass: 'matrix-row--drag-over-above',
    },
    {
      name: 'shows an above-indicator on the drop target row when dragging upward',
      sourceIndex: 2,
      targetIndex: 0,
      expectedClass: 'matrix-row--drag-over-above',
      unexpectedClass: 'matrix-row--drag-over-below',
    },
  ])(
    '$name',
    ({ sourceIndex, targetIndex, expectedClass, unexpectedClass }) => {
      renderWithContext({ store: storeWithCharacter() })
      const sourceLabel = getTaskLabel(DAILY_TASKS[sourceIndex])
      const targetLabel = getTaskLabel(DAILY_TASKS[targetIndex])
      const source = getDragHandle(sourceLabel)
      const targetCell = screen.getByTitle(targetLabel)
      const targetRow = getRowByLabel(targetLabel)
      const dataTransfer = fakeDataTransfer()

      fireEvent.dragStart(source, { dataTransfer })
      fireEvent.dragOver(targetCell, { dataTransfer })

      expect(targetRow).toHaveClass(expectedClass)
      expect(targetRow).not.toHaveClass(unexpectedClass)
    },
  )
})

describe('MatrixView / task label note rendering', () => {
  it('renders the note in a separate element when the label has a note', () => {
    renderWithContext({ store: storeWithCharacter() })
    const label = getTaskLabel(DAILY_TASKS[0])
    const { primary, note } = splitTaskLabel(label)
    if (note === null) {
      throw new Error('expected DAILY_TASKS[0] label to have a note')
    }
    const row = getRowByLabel(label)

    expect(within(row).getByText(primary)).toHaveClass('matrix-task-label-text')
    expect(within(row).getByText(note)).toHaveClass('matrix-task-label-note')
  })

  it('does not render a note element when the label has no note', () => {
    renderWithContext({ store: storeWithCharacter() })
    const label = getTaskLabel(DAILY_TASKS[2])
    const { note } = splitTaskLabel(label)
    if (note !== null) {
      throw new Error('expected DAILY_TASKS[2] label to have no note')
    }
    const row = getRowByLabel(label)

    expect(row.querySelector('.matrix-task-label-note')).not.toBeInTheDocument()
  })
})

describe('MatrixView / hidden tasks', () => {
  it('excludes a hidden task row from rendering while keeping other rows', () => {
    renderWithContext({
      store: storeWithCharacter({ hiddenTaskIds: [TOGGLE_TASK_ID] }),
    })
    expect(
      screen.queryByTitle(getTaskLabel(DAILY_TASKS[0])),
    ).not.toBeInTheDocument()
    expect(screen.getByTitle(getTaskLabel(DAILY_TASKS[1]))).toBeInTheDocument()
  })

  it('shows an empty-state message for a section when every task in it is hidden', () => {
    const allDailyIds = DAILY_TASKS.map((task) => task.id)
    renderWithContext({
      store: storeWithCharacter({ hiddenTaskIds: allDailyIds }),
    })
    expect(screen.getByText(NO_VISIBLE_TASKS_MESSAGE)).toBeInTheDocument()
    expect(screen.getAllByRole('rowheader')).toHaveLength(WEEKLY_TASKS.length)
  })

  it('keeps the drag-and-drop target anchored to the full taskOrder position even when a hidden task sits between visible rows', () => {
    const dailyIds = DAILY_TASKS.map((task) => task.id)
    const { dispatch } = renderWithContext({
      store: storeWithCharacter({ hiddenTaskIds: [dailyIds[1]] }),
    })
    const firstLabel = getTaskLabel(DAILY_TASKS[0])
    const thirdLabel = getTaskLabel(DAILY_TASKS[2])
    const source = getDragHandle(thirdLabel)
    const target = screen.getByTitle(firstLabel)
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.drop(target, { dataTransfer })

    expect(dispatch).toHaveBeenCalledWith(moveTask('daily', dailyIds[2], 0))
  })
})

describe('MatrixView / completed task accordion', () => {
  it('does not render the accordion toggle when no visible task is complete for every displayed character', () => {
    renderWithContext({ store: storeWithCharacter() })
    expect(
      screen.queryByRole('button', { name: /^完了済み/ }),
    ).not.toBeInTheDocument()
  })

  it('moves a fully-completed row into the accordion, opens it without side effects, and collapses again on a fresh render', async () => {
    const label = getTaskLabel(DAILY_TASKS[0])
    const store = storeWithCharacter({
      progress: { [CHARACTER_ID]: { [TOGGLE_TASK_ID]: 1 } },
    })
    const { dispatch } = renderWithContext({ store })
    expect(screen.queryByTitle(label)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: '完了済み（1）' }),
    ).toBeInTheDocument()

    await openCompletedGroup()

    expect(screen.getByTitle(label)).toBeInTheDocument()
    expect(
      within(getRowByLabel(label)).queryByRole('button', {
        name: `${label} をドラッグして並べ替え`,
      }),
    ).not.toBeInTheDocument()
    expect(dispatch).not.toHaveBeenCalled()

    cleanup()
    renderWithContext({ store })

    expect(screen.queryByTitle(label)).not.toBeInTheDocument()
  })

  it('keeps a row in the normal list when only some, not all, displayed characters have completed it', () => {
    const label = getTaskLabel(DAILY_TASKS[0])
    renderWithContext({
      store: storeWithCharacter({
        characters: [DEFAULT_CHARACTER, secondCharacter],
        progress: { [CHARACTER_ID]: { [TOGGLE_TASK_ID]: 1 } },
      }),
    })
    expect(screen.getByTitle(label)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^完了済み/ }),
    ).not.toBeInTheDocument()
  })

  it('keeps drag-and-drop index math anchored to the full task order once a row has moved into the accordion', () => {
    const dailyIds = DAILY_TASKS.map((task) => task.id)
    const { dispatch } = renderWithContext({
      store: storeWithCharacter({
        progress: { [CHARACTER_ID]: { [dailyIds[0]]: 1 } },
      }),
    })
    const source = getDragHandle(getTaskLabel(DAILY_TASKS[2]))
    const target = screen.getByTitle(getTaskLabel(DAILY_TASKS[1]))
    const dataTransfer = fakeDataTransfer()

    fireEvent.dragStart(source, { dataTransfer })
    fireEvent.drop(target, { dataTransfer })

    expect(dispatch).toHaveBeenCalledWith(moveTask('daily', dailyIds[2], 1))
  })

  it('renders an empty normal-list table body without an extra empty-state message when every visible task is complete', () => {
    const allDailyProgress = Object.fromEntries(
      DAILY_TASKS.map((task) => [task.id, task.maxProgress]),
    )
    renderWithContext({
      store: storeWithCharacter({
        progress: { [CHARACTER_ID]: allDailyProgress },
      }),
    })
    const dailySection = screen
      .getByRole('heading', { name: 'デイリー' })
      .closest('.matrix-section')
    if (dailySection === null) {
      throw new Error('daily section not found')
    }
    expect(
      within(dailySection as HTMLElement).queryByText(NO_VISIBLE_TASKS_MESSAGE),
    ).not.toBeInTheDocument()
    expect(
      within(dailySection as HTMLElement).queryAllByRole('rowheader'),
    ).toHaveLength(0)
    expect(
      within(dailySection as HTMLElement).getByRole('button', {
        name: `完了済み（${DAILY_TASKS.length}）`,
      }),
    ).toBeInTheDocument()
  })
})

const getSectionHeader = (title: string) => {
  const heading = screen.getByRole('heading', { name: title })
  const header = heading.closest('.matrix-section-header')
  if (header === null) {
    throw new Error(`section header not found for title: ${title}`)
  }
  return header as HTMLElement
}

describe('MatrixView / section header progress', () => {
  it('shows the summarizeCategoryProgress completed/total counts for the section', () => {
    const dailyTotal = DAILY_TASKS.length
    renderWithContext({
      store: storeWithCharacter({
        progress: { [CHARACTER_ID]: { [TOGGLE_TASK_ID]: 1 } },
      }),
    })
    expect(
      within(getSectionHeader('デイリー')).getByText(`1 / ${dailyTotal} 完了`),
    ).toBeInTheDocument()
  })

  it('excludes a hidden task from the denominator', () => {
    const dailyTotal = DAILY_TASKS.length
    renderWithContext({
      store: storeWithCharacter({ hiddenTaskIds: [TOGGLE_TASK_ID] }),
    })
    expect(
      within(getSectionHeader('デイリー')).getByText(
        `0 / ${dailyTotal - 1} 完了`,
      ),
    ).toBeInTheDocument()
  })

  it('shows 0 / 0 完了 and keeps the 表示タスク設定 button when every task in the section is hidden', () => {
    const allDailyIds = DAILY_TASKS.map((task) => task.id)
    renderWithContext({
      store: storeWithCharacter({ hiddenTaskIds: allDailyIds }),
    })
    const header = getSectionHeader('デイリー')
    expect(within(header).getByText('0 / 0 完了')).toBeInTheDocument()
    expect(
      within(header).getByRole('button', { name: '表示タスク設定' }),
    ).toBeInTheDocument()
  })
})

describe('MatrixView / task visibility trigger', () => {
  it.each([
    { title: 'デイリー', section: 'daily' },
    { title: 'ウィークリー', section: 'weekly' },
  ])(
    'calls onOpenTaskVisibility with the section and the clicked trigger element ($section)',
    async ({ title, section }) => {
      const { onOpenTaskVisibility } = renderWithContext({
        store: storeWithCharacter(),
      })
      const button = within(getSectionHeader(title)).getByRole('button', {
        name: '表示タスク設定',
      })

      await userEvent.click(button)

      expect(onOpenTaskVisibility).toHaveBeenCalledWith(section, button)
    },
  )
})

describe('MatrixView / readonly mode', () => {
  it.each([
    {
      name: 'disables every toggle and checkbox control',
      detailedCountTaskIds: undefined,
    },
    {
      name: 'disables every detailed counter control',
      detailedCountTaskIds: [COUNTER_TASK_ID],
    },
  ])('$name', ({ detailedCountTaskIds }) => {
    renderWithContext({
      store: storeWithCharacter({ detailedCountTaskIds }),
      status: 'readonly',
    })
    // The 表示タスク設定 button only opens the settings modal (it isn't an
    // edit action), so like the gear button it stays enabled in readonly
    // mode and is excluded from this check.
    const buttons = screen
      .getAllByRole('button')
      .filter((button) => button.textContent !== '表示タスク設定')
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) {
      expect(button).toBeDisabled()
    }
  })

  it('keeps the 表示タスク設定 button enabled', () => {
    renderWithContext({
      store: storeWithCharacter(),
      status: 'readonly',
    })
    const actionButtons = screen.getAllByRole('button', {
      name: '表示タスク設定',
    })
    expect(actionButtons.length).toBeGreaterThan(0)
    for (const button of actionButtons) {
      expect(button).toBeEnabled()
    }
  })

  it('disables the drag handle on every task row', () => {
    renderWithContext({
      store: storeWithCharacter(),
      status: 'readonly',
    })
    const handles = screen.getAllByRole('button', {
      name: /をドラッグして並べ替え$/,
    })
    expect(handles.length).toBeGreaterThan(0)
    for (const handle of handles) {
      expect(handle).toBeDisabled()
      expect(handle).toHaveAttribute('draggable', 'false')
    }
  })

  it('keeps the completed-task accordion toggle enabled', () => {
    // Like 表示タスク設定, this only reveals already-persisted rows and
    // performs no edit, so it stays interactive in readonly mode.
    renderWithContext({
      store: storeWithCharacter({
        progress: { [CHARACTER_ID]: { [TOGGLE_TASK_ID]: 1 } },
      }),
      status: 'readonly',
    })
    expect(screen.getByRole('button', { name: '完了済み（1）' })).toBeEnabled()
  })
})
