import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import upstreamTasksDocument from './data/upstreamTasks.json'
import { getTaskLabel } from './data/taskLabel'
import { RECOVERED_MESSAGE } from './store/StoreProvider'
import { STORAGE_KEY } from './store/persistence'

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
})

describe('App / タスク表示設定とマトリクスの連動', () => {
  it('タスク表示のチェックを外すとマトリクスから該当行が消える', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '設定を開く' }))
    await user.type(screen.getByLabelText('キャラクター名'), 'Alice')
    await user.click(screen.getByRole('button', { name: '追加' }))

    const taskLabel = getTaskLabel(upstreamTasksDocument.daily[0])
    const checkbox = screen.getByLabelText(taskLabel)
    expect(checkbox).toBeChecked()
    expect(screen.getByTitle(taskLabel)).toBeInTheDocument()

    await user.click(checkbox)
    expect(checkbox).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: '閉じる' }))
    expect(screen.queryByTitle(taskLabel)).not.toBeInTheDocument()
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
