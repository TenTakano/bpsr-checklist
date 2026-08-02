import { describe, expect, it } from 'vitest'
import { isTaskComplete } from './taskProgress'

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
