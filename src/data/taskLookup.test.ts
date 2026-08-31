import { describe, expect, it } from 'vitest'
import { getTaskCategory } from './taskLookup'
import { DAILY_TASKS, WEEKLY_TASKS } from './projectTasksResolver'

describe('getTaskCategory', () => {
  it.each([
    [DAILY_TASKS[0].id, 'daily'],
    [WEEKLY_TASKS[0].id, 'weekly'],
    ['not_a_real_task_id', null],
  ] as const)('resolves %s to %s', (taskId, expected) => {
    expect(getTaskCategory(taskId)).toBe(expected)
  })
})
