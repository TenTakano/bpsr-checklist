import { describe, expect, it } from 'vitest'
import { getTaskCategory } from './taskLookup'
import upstreamTasksDocument from './upstreamTasks.json'

describe('getTaskCategory', () => {
  it.each([
    [upstreamTasksDocument.daily[0].id, 'daily'],
    [upstreamTasksDocument.weekly[0].id, 'weekly'],
    ['not_a_real_task_id', null],
  ] as const)('resolves %s to %s', (taskId, expected) => {
    expect(getTaskCategory(taskId)).toBe(expected)
  })
})
