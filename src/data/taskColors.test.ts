import { describe, expect, it } from 'vitest'
import { resolveTaskColor } from './taskColors'

describe('resolveTaskColor', () => {
  it.each([
    ['blue', 'var(--task-color-blue)'],
    ['dark_purple', 'var(--task-color-dark-purple)'],
    ['pearl', 'var(--task-color-pearl)'],
    ['not_a_real_token', 'var(--task-color-neutral)'],
    ['constructor', 'var(--task-color-neutral)'],
    ['toString', 'var(--task-color-neutral)'],
    ['valueOf', 'var(--task-color-neutral)'],
    ['__proto__', 'var(--task-color-neutral)'],
  ] as const)('maps %s to %s', (token, expected) => {
    expect(resolveTaskColor(token)).toBe(expected)
  })
})
