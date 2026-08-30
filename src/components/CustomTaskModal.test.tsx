import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  MAX_CUSTOM_TASK_MAX_PROGRESS,
  MAX_CUSTOM_TASK_NAME_LENGTH,
  MAX_CUSTOM_TASKS,
  MIN_CUSTOM_TASK_MAX_PROGRESS,
} from '../data/customTaskSchema'
import { addCustomTask, updateCustomTask } from '../store/actions'
import { StoreContext, type StoreContextValue } from '../store/context'
import {
  buildCustomTask,
  emptyStore,
  storeWithCharacter,
} from '../test/fixtures'
import {
  CUSTOM_TASK_LIMIT_MESSAGE,
  CUSTOM_TASK_MAX_PROGRESS_RANGE_MESSAGE,
  CUSTOM_TASK_NAME_REQUIRED_MESSAGE,
  CUSTOM_TASK_NAME_TOO_LONG_MESSAGE,
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
  const { container } = render(
    <StoreContext.Provider value={value}>
      <CustomTaskModal {...props} />
    </StoreContext.Provider>,
  )
  return { dispatch, container }
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

  it.each([
    ['empty', '', CUSTOM_TASK_NAME_REQUIRED_MESSAGE],
    [
      'too long',
      'a'.repeat(MAX_CUSTOM_TASK_NAME_LENGTH + 1),
      CUSTOM_TASK_NAME_TOO_LONG_MESSAGE,
    ],
  ])(
    'shows an inline error and does not dispatch when the name is %s',
    async (_label, name, expectedMessage) => {
      const user = userEvent.setup()
      const { dispatch } = renderWithContext({
        mode: 'add',
        category: 'daily',
        onClose: vi.fn(),
      })

      fireEvent.change(screen.getByLabelText('名前'), {
        target: { value: name },
      })
      await user.click(screen.getByRole('button', { name: '保存' }))

      expect(screen.getByRole('alert')).toHaveTextContent(expectedMessage)
      expect(dispatch).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['below the minimum', String(MIN_CUSTOM_TASK_MAX_PROGRESS - 1)],
    ['above the maximum', String(MAX_CUSTOM_TASK_MAX_PROGRESS + 1)],
    ['non-integer', '1.5'],
  ])(
    'shows an inline error and does not dispatch when maxProgress is %s',
    async (_label, value) => {
      const user = userEvent.setup()
      const { dispatch } = renderWithContext({
        mode: 'add',
        category: 'daily',
        onClose: vi.fn(),
      })

      await user.type(screen.getByLabelText('名前'), 'テスト')
      const maxProgressInput = screen.getByLabelText('目標回数')
      await user.clear(maxProgressInput)
      await user.type(maxProgressInput, value)
      await user.click(screen.getByRole('button', { name: '保存' }))

      expect(
        screen.getByText(CUSTOM_TASK_MAX_PROGRESS_RANGE_MESSAGE),
      ).toBeInTheDocument()
      expect(dispatch).not.toHaveBeenCalled()
    },
  )

  it('disables saving and shows a limit message once the custom task count reaches the limit', () => {
    const customTasks = Array.from({ length: MAX_CUSTOM_TASKS }, (_, index) =>
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

  it('does not disable saving when the custom task count is at the limit', () => {
    const customTask = buildCustomTask({
      id: 'custom_m1',
      category: 'milestone',
    })
    const customTasks = [
      customTask,
      ...Array.from({ length: MAX_CUSTOM_TASKS - 1 }, (_, index) =>
        buildCustomTask({ id: `custom_limit_${index}`, category: 'daily' }),
      ),
    ]
    renderWithContext(
      {
        mode: 'edit',
        category: 'milestone',
        taskId: 'custom_m1',
        onClose: vi.fn(),
      },
      { store: storeWithCharacter({ customTasks }) },
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保存' })).toBeEnabled()
  })

  it('disables the name, category, color, maxProgress, and save controls when readonly', () => {
    const customTask = buildCustomTask({
      id: 'custom_m1',
      category: 'milestone',
    })
    renderWithContext(
      {
        mode: 'edit',
        category: 'milestone',
        taskId: 'custom_m1',
        onClose: vi.fn(),
      },
      {
        status: 'readonly',
        store: storeWithCharacter({ customTasks: [customTask] }),
      },
    )

    expect(screen.getByLabelText('名前')).toBeDisabled()
    expect(screen.getByLabelText('カテゴリ')).toBeDisabled()
    expect(screen.getByLabelText('目標回数')).toBeDisabled()
    expect(screen.getByRole('button', { name: '保存' })).toBeDisabled()
    for (const swatch of screen.getAllByRole('button', { name: /^色: / })) {
      expect(swatch).toBeDisabled()
    }
  })

  it('disables category readonly in add mode', () => {
    renderWithContext(
      { mode: 'add', category: 'milestone', onClose: vi.fn() },
      { status: 'readonly', store: storeWithCharacter({ customTasks: [] }) },
    )
    expect(screen.getByLabelText('カテゴリ')).toBeDisabled()
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

  it.each([
    ['the overlay itself', '.modal-overlay', true],
    ['inside the dialog', '.modal', false],
  ])(
    'onClose is called only when %s is clicked',
    async (_label, selector, shouldClose) => {
      const user = userEvent.setup()
      const onClose = vi.fn()
      const { container } = renderWithContext({
        mode: 'add',
        category: 'daily',
        onClose,
      })

      const target = container.querySelector(selector)
      if (target === null) {
        throw new Error(`${selector} not found`)
      }
      await user.click(target)

      if (shouldClose) {
        expect(onClose).toHaveBeenCalled()
      } else {
        expect(onClose).not.toHaveBeenCalled()
      }
    },
  )

  it.each([
    ['保存', false, '閉じる'],
    ['閉じる', true, '保存'],
  ])(
    'wraps focus starting from %s (shiftKey: %s) back to %s',
    async (startButtonName, shiftKey, expectedButtonName) => {
      const user = userEvent.setup()
      renderWithContext({ mode: 'add', category: 'daily', onClose: vi.fn() })

      screen.getByRole('button', { name: startButtonName }).focus()
      await user.tab({ shift: shiftKey })

      expect(
        screen.getByRole('button', { name: expectedButtonName }),
      ).toHaveFocus()
    },
  )
})
