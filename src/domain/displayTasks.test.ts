import { describe, expect, it } from 'vitest'
import { PROJECT_TASKS_BY_RESET_CYCLE } from '../data/projectTasksResolver'
import { getTaskLabel } from '../data/taskLabel'
import { buildCustomTask } from '../test/fixtures'
import { getDisplayTasksByCategory } from './displayTasks'

const DAILY_TASKS = PROJECT_TASKS_BY_RESET_CYCLE.daily

describe('getDisplayTasksByCategory', () => {
  it('resolves static tasks for a category using the same label as getTaskLabel', () => {
    const result = getDisplayTasksByCategory('daily', undefined)
    expect(result.map((task) => task.id)).toEqual(
      DAILY_TASKS.map((task) => task.id),
    )
    expect(result[0].label).toBe(getTaskLabel(DAILY_TASKS[0]))
    expect(result[0].color).toBe(DAILY_TASKS[0].color)
    expect(result[0].maxProgress).toBe(DAILY_TASKS[0].maxProgress)
  })

  it('returns an empty list for the milestone category when there are no custom tasks', () => {
    expect(getDisplayTasksByCategory('milestone', undefined)).toEqual([])
  })

  it('appends custom tasks for the category after the static tasks, using the raw name as label', () => {
    const customTasks = [
      buildCustomTask({
        id: 'custom_m1',
        name: 'Custom m1',
        color: 'green',
        maxProgress: 3,
        category: 'milestone',
      }),
    ]
    const result = getDisplayTasksByCategory('milestone', customTasks)
    expect(result).toEqual([
      {
        id: 'custom_m1',
        label: 'Custom m1',
        color: 'green',
        maxProgress: 3,
      },
    ])
  })

  it('filters out custom tasks belonging to a different category', () => {
    const customTasks = [
      buildCustomTask({ id: 'custom_d1', category: 'daily' }),
      buildCustomTask({ id: 'custom_w1', category: 'weekly' }),
    ]
    const result = getDisplayTasksByCategory('milestone', customTasks)
    expect(result).toEqual([])
  })

  it('places a category-matching custom task after all static tasks for that category', () => {
    const customTasks = [
      buildCustomTask({ id: 'custom_d1', category: 'daily' }),
    ]
    const result = getDisplayTasksByCategory('daily', customTasks)
    expect(result).toHaveLength(DAILY_TASKS.length + 1)
    expect(result.at(-1)?.id).toBe('custom_d1')
  })
})
