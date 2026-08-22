import { describe, expect, it } from 'vitest'
import type { ProjectTask } from './projectTaskSchema'
import {
  moveIdInOrder,
  resolveTaskOrder,
  resolveTaskOrderIds,
} from './taskOrder'

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
    const result = resolveTaskOrderIds('daily', undefined)
    expect(result.length).toBeGreaterThan(0)
    expect(new Set(result).size).toBe(result.length)
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
