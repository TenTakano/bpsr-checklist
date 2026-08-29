import { describe, expect, it } from 'vitest'
import type { Task } from '../data/taskSchema'
import { isTaskAvailableOnWeekday } from './taskAvailability'

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task_a',
  label: 'Task A',
  color: '#000000',
  maxProgress: 1,
  optional: false,
  ...overrides,
})

describe('isTaskAvailableOnWeekday', () => {
  it('returns true for every weekday when availableWeekdays is undefined', () => {
    const task = buildTask()

    expect(isTaskAvailableOnWeekday(task, 0)).toBe(true)
    expect(isTaskAvailableOnWeekday(task, 3)).toBe(true)
  })

  it('returns true when the current weekday is included in availableWeekdays', () => {
    const task = buildTask({ availableWeekdays: [5, 6, 0] })

    expect(isTaskAvailableOnWeekday(task, 5)).toBe(true)
  })

  it('returns false when the current weekday is not included in availableWeekdays', () => {
    const task = buildTask({ availableWeekdays: [5, 6, 0] })

    expect(isTaskAvailableOnWeekday(task, 1)).toBe(false)
  })
})
