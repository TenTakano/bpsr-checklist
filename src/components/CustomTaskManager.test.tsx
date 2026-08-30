import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  buildCustomTask,
  emptyStore,
  storeWithCharacter,
} from '../test/fixtures'
import { removeCustomTask } from '../store/actions'
import { StoreContext, type StoreContextValue } from '../store/context'
import { CustomTaskManager } from './CustomTaskManager'

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
      <CustomTaskManager />
    </StoreContext.Provider>,
  )
  return { dispatch }
}

describe('CustomTaskManager / empty state', () => {
  it('shows the overall empty message when no custom tasks exist', () => {
    renderWithContext({ store: storeWithCharacter() })
    expect(
      screen.getByText('カスタムタスクがまだ登録されていません。'),
    ).toBeInTheDocument()
  })

  it('shows a per-category empty message for categories without custom tasks', () => {
    const dailyTask = buildCustomTask({
      id: 'custom_daily1',
      category: 'daily',
      name: 'デイリー用タスク',
    })
    renderWithContext({
      store: storeWithCharacter({ customTasks: [dailyTask] }),
    })

    expect(screen.getByText('デイリー用タスク')).toBeInTheDocument()
    expect(
      screen.getAllByText('このカテゴリのカスタムタスクはありません。'),
    ).toHaveLength(2)
  })
})

describe('CustomTaskManager / listing', () => {
  it('lists custom tasks under their category heading in taskOrder order', () => {
    const taskA = buildCustomTask({
      id: 'custom_a',
      category: 'daily',
      name: 'Task A',
    })
    const taskB = buildCustomTask({
      id: 'custom_b',
      category: 'daily',
      name: 'Task B',
    })
    renderWithContext({
      store: storeWithCharacter({
        customTasks: [taskA, taskB],
        taskOrder: { daily: [taskB.id, taskA.id] },
      }),
    })

    const dailySection = screen
      .getByRole('heading', { name: 'デイリーのカスタムタスク' })
      .closest('.custom-task-manager-section') as HTMLElement
    const names = within(dailySection)
      .getAllByRole('listitem')
      .map((item) => item.textContent)

    expect(names[0]).toContain('Task B')
    expect(names[1]).toContain('Task A')
  })
})

describe('CustomTaskManager / delete confirmation', () => {
  it('does not dispatch removeCustomTask when the confirm dialog is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const task = buildCustomTask({ id: 'custom_a', category: 'daily' })
    const { dispatch } = renderWithContext({
      store: storeWithCharacter({ customTasks: [task] }),
    })
    await userEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('dispatches removeCustomTask when the confirm dialog is accepted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const task = buildCustomTask({ id: 'custom_a', category: 'daily' })
    const { dispatch } = renderWithContext({
      store: storeWithCharacter({ customTasks: [task] }),
    })
    await userEvent.click(screen.getByRole('button', { name: '削除' }))
    expect(dispatch).toHaveBeenCalledWith(removeCustomTask('custom_a'))
  })
})

describe('CustomTaskManager / readonly mode', () => {
  it('disables the delete button when the store is readonly', () => {
    const task = buildCustomTask({ id: 'custom_a', category: 'daily' })
    renderWithContext({
      store: storeWithCharacter({ customTasks: [task] }),
      status: 'readonly',
    })
    expect(screen.getByRole('button', { name: '削除' })).toBeDisabled()
  })
})
