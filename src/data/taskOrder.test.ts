import { describe, expect, it } from 'vitest'
import type { ProjectTask } from './projectTaskSchema'
import {
  moveIdInOrder,
  resolveTaskOrder,
  resolveTaskOrderIds,
} from './taskOrder'
import { buildCustomTask } from '../test/fixtures'

const buildTask = (id: string): ProjectTask => ({
  id,
  label: id,
  color: 'blue',
  maxProgress: 1,
  optional: false,
  resetCycle: 'daily',
})

const TASKS: ProjectTask[] = [buildTask('a'), buildTask('b'), buildTask('c')]

describe('resolveTaskOrder', () => {
  it('returns the tasks in definition order when order is undefined', () => {
    expect(resolveTaskOrder(TASKS, undefined)).toEqual(TASKS)
  })

  it('returns the tasks in definition order when order is empty', () => {
    expect(resolveTaskOrder(TASKS, [])).toEqual(TASKS)
  })

  it('reorders tasks to match a valid stored order', () => {
    const result = resolveTaskOrder(TASKS, ['c', 'a', 'b'])
    expect(result.map((task) => task.id)).toEqual(['c', 'a', 'b'])
  })

  it('appends tasks missing from the stored order, in definition order', () => {
    const result = resolveTaskOrder(TASKS, ['b'])
    expect(result.map((task) => task.id)).toEqual(['b', 'a', 'c'])
  })

  it('ignores ids present in the stored order but absent from the definition', () => {
    const result = resolveTaskOrder(TASKS, ['ghost', 'c', 'a', 'b'])
    expect(result.map((task) => task.id)).toEqual(['c', 'a', 'b'])
  })

  it('ignores duplicate ids within the stored order', () => {
    const result = resolveTaskOrder(TASKS, ['a', 'a', 'b'])
    expect(result.map((task) => task.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('resolveTaskOrderIds', () => {
  it('resolves ids for a real upstream category using definition order as fallback', () => {
    const result = resolveTaskOrderIds('daily', undefined, undefined)
    expect(result.length).toBeGreaterThan(0)
    expect(new Set(result).size).toBe(result.length)
  })

  it('returns no ids for the milestone category when there are no custom tasks', () => {
    expect(resolveTaskOrderIds('milestone', undefined, undefined)).toEqual([])
  })

  it('appends custom tasks for the matching category after the static tasks, in fallback order', () => {
    const customTasks = [
      buildCustomTask({ id: 'custom_m1', category: 'milestone' }),
      buildCustomTask({ id: 'custom_m2', category: 'milestone' }),
    ]
    const result = resolveTaskOrderIds('milestone', undefined, customTasks)
    expect(result).toEqual(['custom_m1', 'custom_m2'])
  })

  it('excludes custom tasks belonging to a different category', () => {
    const customTasks = [
      buildCustomTask({ id: 'custom_d1', category: 'daily' }),
      buildCustomTask({ id: 'custom_w1', category: 'weekly' }),
    ]
    const result = resolveTaskOrderIds('milestone', undefined, customTasks)
    expect(result).toEqual([])
  })

  it('resolves a stored order that interleaves static and custom task ids for the same category', () => {
    const [firstDailyId, secondDailyId] = resolveTaskOrderIds(
      'daily',
      undefined,
      undefined,
    )
    const customTasks = [
      buildCustomTask({ id: 'custom_d1', category: 'daily' }),
    ]
    const result = resolveTaskOrderIds(
      'daily',
      [secondDailyId, 'custom_d1', firstDailyId],
      customTasks,
    )
    expect(result[0]).toBe(secondDailyId)
    expect(result[1]).toBe('custom_d1')
    expect(result[2]).toBe(firstDailyId)
  })
})

describe('moveIdInOrder', () => {
  it('moves an id later in the array', () => {
    expect(moveIdInOrder(['a', 'b', 'c'], 'a', 2)).toEqual(['b', 'c', 'a'])
  })

  it('moves an id earlier in the array', () => {
    expect(moveIdInOrder(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
  })

  it('clamps a target index below 0 to the start', () => {
    expect(moveIdInOrder(['a', 'b', 'c'], 'c', -5)).toEqual(['c', 'a', 'b'])
  })

  it('clamps a target index beyond the end to the last position', () => {
    expect(moveIdInOrder(['a', 'b', 'c'], 'a', 99)).toEqual(['b', 'c', 'a'])
  })

  it('returns the same array reference when the id is already at the target index', () => {
    const order = ['a', 'b', 'c']
    expect(moveIdInOrder(order, 'b', 1)).toBe(order)
  })

  it('returns the same array reference when the id is not present', () => {
    const order = ['a', 'b', 'c']
    expect(moveIdInOrder(order, 'missing', 0)).toBe(order)
  })
})
