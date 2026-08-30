import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { PROJECT_TASKS_BY_RESET_CYCLE } from './data/projectTasksResolver'
import { getTaskLabel } from './data/taskLabel'
import { RECOVERED_MESSAGE } from './store/StoreProvider'
import { STORAGE_KEY } from './store/persistence'

const DAILY_TASKS = PROJECT_TASKS_BY_RESET_CYCLE.daily

describe('App', () => {
  it('BPSR Checklist の見出しを表示する', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: 'BPSR Checklist' }),
    ).toBeInTheDocument()
  })

  it('テーマトグルボタンでテーマを切り替える', async () => {
    const user = userEvent.setup()
    render(<App />)

    const toggle = screen.getByRole('button', {
      name: 'ダークモードに切り替え',
    })
    expect(document.documentElement.dataset.theme).toBe('light')

    await user.click(toggle)

    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(
      screen.getByRole('button', { name: 'ライトモードに切り替え' }),
    ).toBeInTheDocument()
  })
})

describe('App / 設定モーダル', () => {
  it('既定では閉じている', () => {
    render(<App />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('開閉ボタンでモーダルを開閉する', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '設定を開く' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('キャラクター名')).toHaveFocus()

    await user.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('Escキーでモーダルを閉じる', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '設定を開く' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('オーバーレイクリックでモーダルを閉じる', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)

    await user.click(screen.getByRole('button', { name: '設定を開く' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    const overlay = container.querySelector('.modal-overlay')
    if (overlay === null) {
      throw new Error('overlay not found')
    }
    await user.click(overlay)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('閉じるとフォーカスが歯車ボタンへ戻る', async () => {
    const user = userEvent.setup()
    render(<App />)

    const gearButton = screen.getByRole('button', { name: '設定を開く' })
    await user.click(gearButton)
    await user.click(screen.getByRole('button', { name: '閉じる' }))

    expect(gearButton).toHaveFocus()
  })
})

describe('App / セクションの表示タスク設定導線', () => {
  const addCharacterAndCloseSettings = async (
    user: ReturnType<typeof userEvent.setup>,
  ) => {
    await user.click(screen.getByRole('button', { name: '設定を開く' }))
    await user.type(screen.getByLabelText('キャラクター名'), 'Alice')
    await user.click(screen.getByRole('button', { name: '追加' }))
    await user.click(screen.getByRole('button', { name: '閉じる' }))
  }

  it.each([
    { index: 0, heading: 'デイリー' },
    { index: 1, heading: 'ウィークリー' },
  ])(
    '表示タスク設定ボタンから開くと該当セクションの見出しにフォーカスする ($heading)',
    async ({ index, heading }) => {
      const user = userEvent.setup()
      render(<App />)
      await addCharacterAndCloseSettings(user)

      const sectionAction = screen.getAllByRole('button', {
        name: '表示タスク設定',
      })[index]
      await user.click(sectionAction)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: heading, level: 4 }),
      ).toHaveFocus()
    },
  )

  it.each([
    { index: 0, heading: 'デイリー' },
    { index: 1, heading: 'ウィークリー' },
  ])(
    '表示タスク設定ボタンから開いて閉じるとフォーカスが起点ボタンへ戻る ($heading)',
    async ({ index }) => {
      const user = userEvent.setup()
      render(<App />)
      await addCharacterAndCloseSettings(user)

      const sectionAction = screen.getAllByRole('button', {
        name: '表示タスク設定',
      })[index]
      await user.click(sectionAction)
      await user.click(screen.getByRole('button', { name: '閉じる' }))

      expect(sectionAction).toHaveFocus()
    },
  )

  it('起点ボタンがDOMから外れている場合は歯車ボタンへフォーカスが戻る', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<App />)
    // A fresh session already ships with one default (NoName) character, so
    // adding Alice here leaves two characters to delete below.
    await addCharacterAndCloseSettings(user)

    const gearButton = screen.getByRole('button', { name: '設定を開く' })
    const dailySectionAction = screen.getAllByRole('button', {
      name: '表示タスク設定',
    })[0]
    await user.click(dailySectionAction)

    let deleteButtons = screen.getAllByRole('button', { name: '削除' })
    while (deleteButtons.length > 0) {
      await user.click(deleteButtons[0])
      deleteButtons = screen.queryAllByRole('button', { name: '削除' })
    }
    expect(
      screen.queryAllByRole('button', { name: '表示タスク設定' }),
    ).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: '閉じる' }))

    expect(gearButton).toHaveFocus()
  })
})

describe('App / タスク表示設定とマトリクスの連動', () => {
  it('タスク表示のチェックを外すとマトリクスから該当行が消える', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '設定を開く' }))
    await user.type(screen.getByLabelText('キャラクター名'), 'Alice')
    await user.click(screen.getByRole('button', { name: '追加' }))

    const taskLabel = getTaskLabel(DAILY_TASKS[0])
    const checkbox = screen.getByLabelText(taskLabel)
    expect(checkbox).toBeChecked()
    expect(screen.getByTitle(taskLabel)).toBeInTheDocument()

    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByTitle(taskLabel)).not.toBeInTheDocument()
  })
})

describe('App / カスタムタスクモーダル', () => {
  it('タスク追加ボタンから開くと名前欄にフォーカスする', async () => {
    const user = userEvent.setup()
    render(<App />)

    const addButton = screen.getAllByRole('button', {
      name: '＋ タスクを追加',
    })[0]
    await user.click(addButton)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByLabelText('名前')).toHaveFocus()
  })

  it('タスク追加ボタンから開いて閉じるとフォーカスが起点ボタンへ戻る', async () => {
    const user = userEvent.setup()
    render(<App />)

    const addButton = screen.getAllByRole('button', {
      name: '＋ タスクを追加',
    })[0]
    await user.click(addButton)
    await user.click(screen.getByRole('button', { name: '閉じる' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(addButton).toHaveFocus()
  })

  it('タスク追加はクリックしたセクションをカテゴリの既定値として開く', async () => {
    const user = userEvent.setup()
    render(<App />)

    const milestoneAddButton = screen.getAllByRole('button', {
      name: '＋ タスクを追加',
    })[2]
    await user.click(milestoneAddButton)

    expect(screen.getByLabelText('カテゴリ')).toHaveValue('milestone')
  })

  it('編集トリガーから開いて閉じるとフォーカスが起点ボタンへ戻る', async () => {
    const user = userEvent.setup()
    render(<App />)

    const addButton = screen.getAllByRole('button', {
      name: '＋ タスクを追加',
    })[0]
    await user.click(addButton)
    await user.type(screen.getByLabelText('名前'), 'カスタムタスク')
    await user.click(screen.getByRole('button', { name: '保存' }))

    const editButton = screen.getByRole('button', {
      name: 'カスタムタスク を編集',
    })
    await user.click(editButton)
    expect(
      screen.getByRole('heading', { name: 'タスクを編集' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '閉じる' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(editButton).toHaveFocus()
  })
})

describe('App / ステータスバナー', () => {
  it('モーダルを開かなくてもバナーが表示される', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')
    render(<App />)

    expect(screen.getByRole('alert')).toHaveTextContent(RECOVERED_MESSAGE)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
