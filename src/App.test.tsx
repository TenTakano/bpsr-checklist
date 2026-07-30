import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

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
