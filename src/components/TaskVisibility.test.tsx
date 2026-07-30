import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import upstreamTasksDocument from '../data/upstreamTasks.json'
import { getTaskLabel } from '../data/taskLabel'
import { emptyStore, storeWithCharacter } from '../test/fixtures'
import { setTaskHidden } from '../store/actions'
import { StoreContext, type StoreContextValue } from '../store/context'
import { TaskVisibility } from './TaskVisibility'

const DAILY_TASK_ID = upstreamTasksDocument.daily[0].id
const DAILY_TASK_LABEL = getTaskLabel(upstreamTasksDocument.daily[0])

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
})
