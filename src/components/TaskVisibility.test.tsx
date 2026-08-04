import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import upstreamTasksDocument from '../data/upstreamTasks.json'
import { getTaskLabel } from '../data/taskLabel'
import { emptyStore, storeWithCharacter } from '../test/fixtures'
import { setTaskDetailedCount, setTaskHidden } from '../store/actions'
import { StoreContext, type StoreContextValue } from '../store/context'
import { TaskVisibility } from './TaskVisibility'

const DAILY_TASK_ID = upstreamTasksDocument.daily[0].id
const DAILY_TASK_LABEL = getTaskLabel(upstreamTasksDocument.daily[0])
if (upstreamTasksDocument.daily[0].maxProgress !== 1) {
  throw new Error(
    'upstreamTasksDocument.daily[0] must have maxProgress 1 for these tests',
  )
}

const COUNTER_TASK_ID = upstreamTasksDocument.daily[2].id
const COUNTER_TASK_LABEL = getTaskLabel(upstreamTasksDocument.daily[2])
if (upstreamTasksDocument.daily[2].maxProgress <= 1) {
  throw new Error(
    'upstreamTasksDocument.daily[2] must have maxProgress > 1 for these tests',
  )
}
const DETAILED_COUNT_CHECKBOX_NAME = `${COUNTER_TASK_LABEL} を詳細カウント表示にする`

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
      <TaskVisibility />
    </StoreContext.Provider>,
  )
  return { dispatch }
}

describe('TaskVisibility / checkbox state', () => {
  it('checks every task by default when hiddenTaskIds is absent', () => {
    renderWithContext({ store: storeWithCharacter() })
    expect(screen.getByLabelText(DAILY_TASK_LABEL)).toBeChecked()
  })

  it('unchecks a task listed in hiddenTaskIds', () => {
    renderWithContext({
      store: storeWithCharacter({ hiddenTaskIds: [DAILY_TASK_ID] }),
    })
    expect(screen.getByLabelText(DAILY_TASK_LABEL)).not.toBeChecked()
  })
})

describe('TaskVisibility / toggling', () => {
  it('dispatches setTaskHidden(taskId, true) when a visible task is unchecked', async () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    await userEvent.click(screen.getByLabelText(DAILY_TASK_LABEL))
    expect(dispatch).toHaveBeenCalledWith(setTaskHidden(DAILY_TASK_ID, true))
  })

  it('dispatches setTaskHidden(taskId, false) when a hidden task is checked', async () => {
    const { dispatch } = renderWithContext({
      store: storeWithCharacter({ hiddenTaskIds: [DAILY_TASK_ID] }),
    })
    await userEvent.click(screen.getByLabelText(DAILY_TASK_LABEL))
    expect(dispatch).toHaveBeenCalledWith(setTaskHidden(DAILY_TASK_ID, false))
  })
})

describe('TaskVisibility / readonly mode', () => {
  it('disables every checkbox when the store is readonly', () => {
    renderWithContext({ store: storeWithCharacter(), status: 'readonly' })
    expect(screen.getByLabelText(DAILY_TASK_LABEL)).toBeDisabled()
  })

  it('disables the detailed count checkbox when the store is readonly', () => {
    renderWithContext({ store: storeWithCharacter(), status: 'readonly' })
    expect(
      screen.getByRole('checkbox', { name: DETAILED_COUNT_CHECKBOX_NAME }),
    ).toBeDisabled()
  })
})

describe('TaskVisibility / detailed count checkbox', () => {
  it('renders the detailed count checkbox only for tasks with maxProgress >= 2', () => {
    renderWithContext({ store: storeWithCharacter() })
    expect(
      screen.queryByRole('checkbox', {
        name: `${DAILY_TASK_LABEL} を詳細カウント表示にする`,
      }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: DETAILED_COUNT_CHECKBOX_NAME }),
    ).toBeInTheDocument()
  })

  it('unchecks the detailed count checkbox by default', () => {
    renderWithContext({ store: storeWithCharacter() })
    expect(
      screen.getByRole('checkbox', { name: DETAILED_COUNT_CHECKBOX_NAME }),
    ).not.toBeChecked()
  })

  it('checks the detailed count checkbox for a task listed in detailedCountTaskIds', () => {
    renderWithContext({
      store: storeWithCharacter({ detailedCountTaskIds: [COUNTER_TASK_ID] }),
    })
    expect(
      screen.getByRole('checkbox', { name: DETAILED_COUNT_CHECKBOX_NAME }),
    ).toBeChecked()
  })

  it('dispatches setTaskDetailedCount(taskId, true) when checked', async () => {
    const { dispatch } = renderWithContext({ store: storeWithCharacter() })
    await userEvent.click(
      screen.getByRole('checkbox', { name: DETAILED_COUNT_CHECKBOX_NAME }),
    )
    expect(dispatch).toHaveBeenCalledWith(
      setTaskDetailedCount(COUNTER_TASK_ID, true),
    )
  })

  it('dispatches setTaskDetailedCount(taskId, false) when unchecked', async () => {
    const { dispatch } = renderWithContext({
      store: storeWithCharacter({ detailedCountTaskIds: [COUNTER_TASK_ID] }),
    })
    await userEvent.click(
      screen.getByRole('checkbox', { name: DETAILED_COUNT_CHECKBOX_NAME }),
    )
    expect(dispatch).toHaveBeenCalledWith(
      setTaskDetailedCount(COUNTER_TASK_ID, false),
    )
  })
})
