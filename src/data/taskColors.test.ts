import { describe, expect, it } from 'vitest'
import {
  TASK_COLOR_TOKENS,
  TaskColorTokenSchema,
  resolveTaskColor,
} from './taskColors'

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

describe('TASK_COLOR_TOKENS', () => {
  it('contains exactly the 10 known tokens', () => {
    expect(TASK_COLOR_TOKENS).toEqual([
      'blue',
      'brown',
      'dark_purple',
      'gold',
      'green',
      'grey',
      'orange',
      'pearl',
      'purple',
      'yellow',
    ])
  })
})

describe('TaskColorTokenSchema', () => {
  it.each(TASK_COLOR_TOKENS)('accepts %s', (token) => {
    expect(TaskColorTokenSchema.safeParse(token).success).toBe(true)
  })

  it('rejects an unknown token', () => {
    expect(TaskColorTokenSchema.safeParse('not_a_real_token').success).toBe(
      false,
    )
  })
})
