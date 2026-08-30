import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addCustomTask, updateCustomTask } from '../store/actions'
import { StoreContext, type StoreContextValue } from '../store/context'
import { MAX_IMPORT_CUSTOM_TASKS } from '../store/backup'
import {
  buildCustomTask,
  emptyStore,
  storeWithCharacter,
} from '../test/fixtures'
import {
  CUSTOM_TASK_LIMIT_MESSAGE,
  CUSTOM_TASK_MAX_PROGRESS_RANGE_MESSAGE,
  CUSTOM_TASK_NAME_REQUIRED_MESSAGE,
  CustomTaskModal,
} from './CustomTaskModal'

const renderWithContext = (
  props: Parameters<typeof CustomTaskModal>[0],
  overrides: Partial<StoreContextValue> = {},
) => {
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
      <CustomTaskModal {...props} />
    </StoreContext.Provider>,
  )
  return { dispatch }
}

describe('CustomTaskModal / add mode', () => {
  it('focuses the name input on mount', () => {
    renderWithContext({ mode: 'add', category: 'daily', onClose: vi.fn() })
    expect(screen.getByLabelText('名前')).toHaveFocus()
  })

  it('shows the add-mode title and defaults the category to the one passed in', () => {
    renderWithContext({ mode: 'add', category: 'weekly', onClose: vi.fn() })
    expect(
      screen.getByRole('heading', { name: 'タスクを追加' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('カテゴリ')).toHaveValue('weekly')
    expect(screen.getByLabelText('カテゴリ')).toBeEnabled()
  })

  it('dispatches addCustomTask with the entered values and closes on save', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { dispatch } = renderWithContext({
      mode: 'add',
      category: 'milestone',
      onClose,
    })

    await user.type(screen.getByLabelText('名前'), 'ギルド討伐')
    await user.selectOptions(screen.getByLabelText('カテゴリ'), 'weekly')
    await user.click(screen.getByRole('button', { name: '色: 緑' }))
    const maxProgressInput = screen.getByLabelText('目標回数')
    await user.clear(maxProgressInput)
    await user.type(maxProgressInput, '10')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(dispatch).toHaveBeenCalledWith(
      addCustomTask('ギルド討伐', 'green', 10, 'weekly'),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an inline error and does not dispatch when the name is empty', async () => {
    const user = userEvent.setup()
    const { dispatch } = renderWithContext({
      mode: 'add',
      category: 'daily',
      onClose: vi.fn(),
    })

    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      CUSTOM_TASK_NAME_REQUIRED_MESSAGE,
    )
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('shows an inline error and does not dispatch when maxProgress is out of range', async () => {
    const user = userEvent.setup()
    const { dispatch } = renderWithContext({
      mode: 'add',
      category: 'daily',
      onClose: vi.fn(),
    })

    await user.type(screen.getByLabelText('名前'), 'テスト')
    const maxProgressInput = screen.getByLabelText('目標回数')
    await user.clear(maxProgressInput)
    await user.type(maxProgressInput, '0')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(
      screen.getByText(CUSTOM_TASK_MAX_PROGRESS_RANGE_MESSAGE),
    ).toBeInTheDocument()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('disables saving and shows a limit message once the custom task count reaches the import limit', () => {
    const customTasks = Array.from(
      { length: MAX_IMPORT_CUSTOM_TASKS },
      (_, index) =>
        buildCustomTask({ id: `custom_limit_${index}`, category: 'daily' }),
    )
    renderWithContext(
      { mode: 'add', category: 'daily', onClose: vi.fn() },
      { store: storeWithCharacter({ customTasks }) },
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      CUSTOM_TASK_LIMIT_MESSAGE,
    )
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
  })
})

describe('CustomTaskModal / edit mode', () => {
  it('shows the edit-mode title, pre-fills fields, and disables the category select', () => {
    const customTask = buildCustomTask({
      id: 'custom_m1',
      category: 'milestone',
      name: 'ギルド討伐',
      color: 'purple',
      maxProgress: 5,
    })
    renderWithContext(
      {
        mode: 'edit',
        category: 'milestone',
        taskId: 'custom_m1',
        onClose: vi.fn(),
      },
      { store: storeWithCharacter({ customTasks: [customTask] }) },
    )

    expect(
      screen.getByRole('heading', { name: 'タスクを編集' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('名前')).toHaveValue('ギルド討伐')
    expect(screen.getByLabelText('目標回数')).toHaveValue(5)
    expect(screen.getByLabelText('カテゴリ')).toHaveValue('milestone')
    expect(screen.getByLabelText('カテゴリ')).toBeDisabled()
    expect(screen.getByRole('button', { name: '色: 紫' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('dispatches updateCustomTask with the edited values, preserving the original category', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const customTask = buildCustomTask({
      id: 'custom_m1',
      category: 'milestone',
      name: 'ギルド討伐',
      color: 'purple',
      maxProgress: 5,
    })
    const { dispatch } = renderWithContext(
      { mode: 'edit', category: 'milestone', taskId: 'custom_m1', onClose },
      { store: storeWithCharacter({ customTasks: [customTask] }) },
    )

    const nameInput = screen.getByLabelText('名前')
    await user.clear(nameInput)
    await user.type(nameInput, 'ギルド討伐（改）')
    await user.click(screen.getByRole('button', { name: '保存' }))

    expect(dispatch).toHaveBeenCalledWith(
      updateCustomTask(
        'custom_m1',
        'ギルド討伐（改）',
        'purple',
        5,
        'milestone',
      ),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it('closes immediately when the edit target no longer exists in the store', () => {
    const onClose = vi.fn()
    renderWithContext(
      { mode: 'edit', category: 'milestone', taskId: 'missing', onClose },
      { store: storeWithCharacter({ customTasks: [] }) },
    )
    expect(onClose).toHaveBeenCalled()
  })
})

describe('CustomTaskModal / keyboard interaction', () => {
  it('closes on Escape', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    renderWithContext({ mode: 'add', category: 'daily', onClose })

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalled()
  })

  it('closes when the overlay is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const { container } = render(
      <StoreContext.Provider
        value={{
          store: emptyStore(),
          status: 'ok',
          message: null,
          dispatch: vi.fn(),
        }}
      >
        <CustomTaskModal mode="add" category="daily" onClose={onClose} />
      </StoreContext.Provider>,
    )

    const overlay = container.querySelector('.modal-overlay')
    if (overlay === null) {
      throw new Error('overlay not found')
    }
    await user.click(overlay)

    expect(onClose).toHaveBeenCalled()
  })

  it('wraps Tab focus from the last focusable element back to the first', async () => {
    const user = userEvent.setup()
    renderWithContext({ mode: 'add', category: 'daily', onClose: vi.fn() })

    const saveButton = screen.getByRole('button', { name: '保存' })
    saveButton.focus()
    await user.tab()

    expect(screen.getByRole('button', { name: '閉じる' })).toHaveFocus()
  })

  it('wraps Shift+Tab focus from the first focusable element back to the last', async () => {
    const user = userEvent.setup()
    renderWithContext({ mode: 'add', category: 'daily', onClose: vi.fn() })

    screen.getByRole('button', { name: '閉じる' }).focus()
    await user.tab({ shift: true })

    expect(screen.getByRole('button', { name: '保存' })).toHaveFocus()
  })
})
