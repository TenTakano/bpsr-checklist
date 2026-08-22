import { describe, expect, it } from 'vitest'
import { getTaskCategory } from './taskLookup'
import { PROJECT_TASKS_BY_RESET_CYCLE } from './projectTasksResolver'

describe('getTaskCategory', () => {
  it.each([
    [PROJECT_TASKS_BY_RESET_CYCLE.daily[0].id, 'daily'],
    [PROJECT_TASKS_BY_RESET_CYCLE.weekly[0].id, 'weekly'],
    ['not_a_real_task_id', null],
  ] as const)('resolves %s to %s', (taskId, expected) => {
    expect(getTaskCategory(taskId)).toBe(expected)
  })
})
