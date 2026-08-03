import { describe, expect, it } from 'vitest'
import type { Store } from '../store/types'
import { isTaskComplete, readProgressValue } from './taskProgress'

describe('isTaskComplete', () => {
  it('returns false when value is below maxProgress', () => {
    expect(isTaskComplete(1, 3)).toBe(false)
  })

  it('returns true when value equals maxProgress', () => {
    expect(isTaskComplete(3, 3)).toBe(true)
  })

  it('returns true when value exceeds maxProgress', () => {
    expect(isTaskComplete(4, 3)).toBe(true)
  })
})

describe('readProgressValue', () => {
  it('returns the stored value when character and task exist', () => {
    const progress: Store['progress'] = { char_1: { task_a: 2 } }

    expect(readProgressValue(progress, 'char_1', 'task_a')).toBe(2)
  })

  it.each([
    [
      'character is not registered in progress',
      { char_1: { task_a: 2 } } as Store['progress'],
      'char_2',
      'task_a',
    ],
    [
      'taskId is not registered for the character',
      { char_1: { task_a: 2 } } as Store['progress'],
      'char_1',
      'task_b',
    ],
    [
      'stored value is undefined',
      {
        char_1: { task_a: undefined as unknown as number },
      } as Store['progress'],
      'char_1',
      'task_a',
    ],
  ])('returns 0 when the %s', (_description, progress, characterId, taskId) => {
    expect(readProgressValue(progress, characterId, taskId)).toBe(0)
  })
})
