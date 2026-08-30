import { describe, expect, it } from 'vitest'
import { getTaskCategory, TaskCategorySchema } from './taskLookup'
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

describe('TaskCategorySchema', () => {
  it.each([
    ['daily', true],
    ['weekly', true],
    ['milestone', true],
    ['not_a_category', false],
  ] as const)('%s is valid: %s', (category, expected) => {
    expect(TaskCategorySchema.safeParse(category).success).toBe(expected)
  })
})
