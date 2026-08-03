import { describe, expect, it } from 'vitest'
import type { Task } from '../data/taskSchema'
import type { Character } from '../store/schema'
import type { Store } from '../store/types'
import { summarizeCategoryProgress } from './progressSummary'

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task_a',
  label: 'タスクA',
  color: 'blue',
  maxProgress: 1,
  optional: false,
  ...overrides,
})

const buildCharacter = (id: string): Character => ({
  id,
  name: id,
  createdAt: '2024-01-01T00:00:00.000Z',
})

describe('summarizeCategoryProgress', () => {
  it('aggregates completed and total counts across multiple characters', () => {
    const tasks = [buildTask({ id: 'task_a' }), buildTask({ id: 'task_b' })]
    const characters = [buildCharacter('char_1'), buildCharacter('char_2')]
    const progress: Store['progress'] = {
      char_1: { task_a: 1, task_b: 0 },
      char_2: { task_a: 1, task_b: 1 },
    }

    const summary = summarizeCategoryProgress(
      tasks,
      characters,
      progress,
      undefined,
    )

    expect(summary.completed).toBe(3)
    expect(summary.total).toBe(4)
    expect(summary.percent).toBe(75)
    expect(summary.byCharacter).toEqual([
      { characterId: 'char_1', completed: 1, total: 2 },
      { characterId: 'char_2', completed: 2, total: 2 },
    ])
  })

  it('excludes tasks in hiddenTaskIds from both numerator and denominator', () => {
    const tasks = [buildTask({ id: 'task_a' }), buildTask({ id: 'task_b' })]
    const characters = [buildCharacter('char_1')]
    const progress: Store['progress'] = {
      char_1: { task_a: 1, task_b: 1 },
    }

    const summary = summarizeCategoryProgress(tasks, characters, progress, [
      'task_b',
    ])

    expect(summary.completed).toBe(1)
    expect(summary.total).toBe(1)
    expect(summary.byCharacter).toEqual([
      { characterId: 'char_1', completed: 1, total: 1 },
    ])
  })

  it.each([
    {
      name: 'there are no characters',
      tasks: [buildTask()],
      characters: [] as Character[],
      progress: {} as Store['progress'],
      hiddenTaskIds: undefined,
      expected: { completed: 0, total: 0, percent: 0, byCharacter: [] },
    },
    {
      name: 'all tasks in the target category are hidden',
      tasks: [buildTask({ id: 'task_a' })],
      characters: [buildCharacter('char_1')],
      progress: {} as Store['progress'],
      hiddenTaskIds: ['task_a'],
      expected: {
        completed: 0,
        total: 0,
        percent: 0,
        byCharacter: [{ characterId: 'char_1', completed: 0, total: 0 }],
      },
    },
    {
      name: "the character's key is missing from progress",
      tasks: [buildTask({ id: 'task_a' })],
      characters: [buildCharacter('char_1'), buildCharacter('char_2')],
      progress: { char_1: { task_a: 1 } } as Store['progress'],
      hiddenTaskIds: undefined,
      expected: {
        completed: 1,
        total: 2,
        percent: 50,
        byCharacter: [
          { characterId: 'char_1', completed: 1, total: 1 },
          { characterId: 'char_2', completed: 0, total: 1 },
        ],
      },
    },
    {
      name: 'the taskId key is missing from characterProgress',
      tasks: [buildTask({ id: 'task_a' }), buildTask({ id: 'task_b' })],
      characters: [buildCharacter('char_1')],
      progress: { char_1: { task_a: 1 } } as Store['progress'],
      hiddenTaskIds: undefined,
      expected: {
        completed: 1,
        total: 2,
        percent: 50,
        byCharacter: [{ characterId: 'char_1', completed: 1, total: 2 }],
      },
    },
  ])(
    'treats it as incomplete (0%, never NaN) when $name',
    ({ tasks, characters, progress, hiddenTaskIds, expected }) => {
      const summary = summarizeCategoryProgress(
        tasks,
        characters,
        progress,
        hiddenTaskIds,
      )

      expect(summary).toEqual(expected)
    },
  )

  it('counts a partial (not-yet-reached) count-based task value as incomplete', () => {
    const tasks = [buildTask({ id: 'task_a', maxProgress: 3 })]
    const characters = [buildCharacter('char_1')]
    const progress: Store['progress'] = { char_1: { task_a: 2 } }

    const summary = summarizeCategoryProgress(
      tasks,
      characters,
      progress,
      undefined,
    )

    expect(summary.completed).toBe(0)
    expect(summary.total).toBe(1)
  })
})
