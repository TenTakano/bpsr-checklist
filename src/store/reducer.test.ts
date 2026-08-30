import { describe, expect, it, vi } from 'vitest'
import { MAX_CUSTOM_TASKS } from '../data/customTaskSchema'
import { PROJECT_TASKS_BY_RESET_CYCLE } from '../data/projectTasksResolver'
import {
  buildCustomTask,
  emptyStore,
  storeWithCharacter,
} from '../test/fixtures'
import {
  addCharacter,
  addCustomTask,
  duplicateCharacter,
  evaluateReset,
  moveTask,
  removeCharacter,
  removeCustomTask,
  renameCharacter,
  setProgress,
  setTaskDetailedCount,
  setTaskHidden,
  updateCustomTask,
} from './actions'
import { evaluateResetState, reducer } from './reducer'

const DAILY_TASKS = PROJECT_TASKS_BY_RESET_CYCLE.daily
const WEEKLY_TASKS = PROJECT_TASKS_BY_RESET_CYCLE.weekly
const DAILY_TASK_ID = DAILY_TASKS[0].id
const WEEKLY_TASK_ID = WEEKLY_TASKS[0].id
const DAILY_TASK_IDS = DAILY_TASKS.map((task) => task.id)

describe('reducer / addCharacter', () => {
  it('appends a character with a trimmed name', () => {
    const result = reducer(emptyStore(), addCharacter('  Alice  '))
    expect(result.characters).toHaveLength(1)
    expect(result.characters[0].name).toBe('Alice')
    expect(result.characters[0].id).toBeTruthy()
    expect(result.characters[0].createdAt).toBeTruthy()
  })

  it('rejects an empty (or whitespace-only) name', () => {
    const store = emptyStore()
    expect(reducer(store, addCharacter('   '))).toBe(store)
  })

  it('rejects a name longer than 50 characters', () => {
    const store = emptyStore()
    expect(reducer(store, addCharacter('a'.repeat(51)))).toBe(store)
  })

  it('accepts a name exactly at the 50 character limit', () => {
    const result = reducer(emptyStore(), addCharacter('a'.repeat(50)))
    expect(result.characters[0].name).toHaveLength(50)
  })
})

describe('reducer / renameCharacter', () => {
  it('renames an existing character', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const result = reducer(withCharacter, renameCharacter(id, 'Bob'))
    expect(result.characters[0].name).toBe('Bob')
  })

  it('is a no-op when the character does not exist', () => {
    const store = emptyStore()
    expect(reducer(store, renameCharacter('missing', 'Bob'))).toBe(store)
  })

  it('is a no-op when the new name is empty after trim', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const result = reducer(withCharacter, renameCharacter(id, '   '))
    expect(result).toBe(withCharacter)
  })
})

describe('reducer / duplicateCharacter', () => {
  it('duplicates a character together with its progress', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const withProgress = reducer(
      withCharacter,
      setProgress(id, DAILY_TASK_ID, 3),
    )
    const result = reducer(withProgress, duplicateCharacter(id))

    expect(result.characters).toHaveLength(2)
    const copy = result.characters[1]
    expect(copy.name).toBe('Alice のコピー')
    expect(copy.id).not.toBe(id)
    expect(result.progress[copy.id]).toEqual({ [DAILY_TASK_ID]: 3 })
    expect(result.progress[id]).toEqual({ [DAILY_TASK_ID]: 3 })
  })

  it('is a no-op when the source character does not exist', () => {
    const store = emptyStore()
    expect(reducer(store, duplicateCharacter('missing'))).toBe(store)
  })

  it('truncates the duplicated name so it never exceeds the 50 character limit', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('a'.repeat(50)))
    const id = withCharacter.characters[0].id
    const result = reducer(withCharacter, duplicateCharacter(id))
    const copy = result.characters[1]
    expect(copy.name.length).toBeLessThanOrEqual(50)
    expect(copy.name).toBe(`${'a'.repeat(45)} のコピー`)
  })
})

describe('reducer / removeCharacter', () => {
  it('removes the character and its progress entry', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const withProgress = reducer(
      withCharacter,
      setProgress(id, DAILY_TASK_ID, 1),
    )
    const result = reducer(withProgress, removeCharacter(id))

    expect(result.characters).toHaveLength(0)
    expect(result.progress[id]).toBeUndefined()
  })

  it('is a no-op when the character does not exist', () => {
    const store = emptyStore()
    expect(reducer(store, removeCharacter('missing'))).toBe(store)
  })
})

describe('reducer / setProgress', () => {
  it('sets a non-negative integer progress value', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const result = reducer(withCharacter, setProgress(id, DAILY_TASK_ID, 2))
    expect(result.progress[id]).toEqual({ [DAILY_TASK_ID]: 2 })
  })

  it('preserves other task progress entries for the same character', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const first = reducer(withCharacter, setProgress(id, DAILY_TASK_ID, 1))
    const second = reducer(first, setProgress(id, WEEKLY_TASK_ID, 2))
    expect(second.progress[id]).toEqual({
      [DAILY_TASK_ID]: 1,
      [WEEKLY_TASK_ID]: 2,
    })
  })

  it('rejects negative values', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const result = reducer(withCharacter, setProgress(id, DAILY_TASK_ID, -1))
    expect(result).toBe(withCharacter)
  })

  it('rejects non-integer values', () => {
    const withCharacter = reducer(emptyStore(), addCharacter('Alice'))
    const id = withCharacter.characters[0].id
    const result = reducer(withCharacter, setProgress(id, DAILY_TASK_ID, 1.5))
    expect(result).toBe(withCharacter)
  })

  it('is a no-op when the character does not exist', () => {
    const store = emptyStore()
    expect(reducer(store, setProgress('missing', DAILY_TASK_ID, 1))).toBe(store)
  })
})

describe('reducer / moveTask', () => {
  it('creates a taskOrder from definition order and applies the move on first use', () => {
    const store = emptyStore()
    const result = reducer(store, moveTask('daily', DAILY_TASK_IDS[0], 2))

    const expectedDaily = [...DAILY_TASK_IDS]
    const [moved] = expectedDaily.splice(0, 1)
    expectedDaily.splice(2, 0, moved)

    expect(result.taskOrder?.daily).toEqual(expectedDaily)
  })

  it('leaves the other section untouched (resolved to definition order) when moving within one section', () => {
    const store = emptyStore()
    const result = reducer(store, moveTask('daily', DAILY_TASK_IDS[0], 1))
    expect(result.taskOrder?.weekly).toEqual(
      WEEKLY_TASKS.map((task) => task.id),
    )
  })

  it('moves an id within an existing stored order', () => {
    const reordered = [...DAILY_TASK_IDS].reverse()
    const store = storeWithCharacter({
      taskOrder: {
        daily: reordered,
        weekly: WEEKLY_TASKS.map((task) => task.id),
      },
    })
    const result = reducer(store, moveTask('daily', reordered[0], 3))

    const expected = [...reordered]
    const [moved] = expected.splice(0, 1)
    expected.splice(3, 0, moved)
    expect(result.taskOrder?.daily).toEqual(expected)
  })

  it('is a no-op when the taskId does not exist in the section', () => {
    const store = emptyStore()
    const result = reducer(store, moveTask('daily', 'not-a-real-task', 0))
    expect(result).toBe(store)
  })

  it('supplements a partial stored order with newly-added definition tasks before moving', () => {
    const store = storeWithCharacter({
      taskOrder: {
        daily: [DAILY_TASK_IDS[1]],
        weekly: WEEKLY_TASKS.map((task) => task.id),
      },
    })
    const result = reducer(store, moveTask('daily', DAILY_TASK_IDS[1], 1))

    const supplemented = [
      DAILY_TASK_IDS[1],
      ...DAILY_TASK_IDS.filter((id) => id !== DAILY_TASK_IDS[1]),
    ]
    const expected = [...supplemented]
    const [moved] = expected.splice(0, 1)
    expected.splice(1, 0, moved)
    expect(result.taskOrder?.daily).toEqual(expected)
  })

  it('ignores ids from a stored order that no longer exist in the definition', () => {
    const store = storeWithCharacter({
      taskOrder: {
        daily: ['ghost_task', ...DAILY_TASK_IDS],
        weekly: WEEKLY_TASKS.map((task) => task.id),
      },
    })
    // DAILY_TASK_IDS[0] resolves to index 0 once ghost_task is filtered out,
    // so it must move to a different index for the reducer to persist a
    // (ghost_task-free) taskOrder at all.
    const result = reducer(store, moveTask('daily', DAILY_TASK_IDS[0], 5))
    expect(result.taskOrder?.daily).not.toContain('ghost_task')
  })

  it('is a no-op for the milestone section when it has no custom tasks', () => {
    const store = emptyStore()
    const result = reducer(store, moveTask('milestone', 'any-task', 0))
    expect(result).toBe(store)
  })

  it('reorders custom tasks within the milestone section', () => {
    const withTasks = [
      addCustomTask('Milestone A', 'blue', 1, 'milestone'),
      addCustomTask('Milestone B', 'green', 1, 'milestone'),
    ].reduce((store, action) => reducer(store, action), emptyStore())
    const [taskA, taskB] = withTasks.customTasks ?? []

    const result = reducer(withTasks, moveTask('milestone', taskA.id, 1))

    expect(result.taskOrder?.milestone).toEqual([taskB.id, taskA.id])
  })

  it('moves a custom task among static tasks within the daily section', () => {
    const withTask = reducer(
      emptyStore(),
      addCustomTask('Custom Daily', 'blue', 1, 'daily'),
    )
    const customTaskId = withTask.customTasks?.[0].id as string

    const result = reducer(withTask, moveTask('daily', customTaskId, 0))

    expect(result.taskOrder?.daily?.[0]).toBe(customTaskId)
  })

  it('moves a custom task within the weekly section', () => {
    const withTasks = [
      addCustomTask('Custom Weekly A', 'blue', 1, 'weekly'),
      addCustomTask('Custom Weekly B', 'green', 1, 'weekly'),
    ].reduce((store, action) => reducer(store, action), emptyStore())
    const [taskA, taskB] = withTasks.customTasks ?? []
    const currentOrder = withTasks.taskOrder?.weekly ?? [
      ...WEEKLY_TASKS.map((task) => task.id),
      taskA.id,
      taskB.id,
    ]
    const targetIndex = currentOrder.indexOf(taskA.id)

    const result = reducer(withTasks, moveTask('weekly', taskB.id, targetIndex))

    expect(result.taskOrder?.weekly?.indexOf(taskB.id)).toBe(targetIndex)
  })
})

describe('reducer / setTaskHidden', () => {
  it('adds a taskId to hiddenTaskIds when hiding a visible task', () => {
    const store = emptyStore()
    const result = reducer(store, setTaskHidden(DAILY_TASK_ID, true))
    expect(result.hiddenTaskIds).toEqual([DAILY_TASK_ID])
  })

  it('removes a taskId from hiddenTaskIds when unhiding it', () => {
    const store = storeWithCharacter({ hiddenTaskIds: [DAILY_TASK_ID] })
    const result = reducer(store, setTaskHidden(DAILY_TASK_ID, false))
    expect(result.hiddenTaskIds).toEqual([])
  })

  it('preserves other hidden ids untouched', () => {
    const store = storeWithCharacter({
      hiddenTaskIds: [DAILY_TASK_ID, WEEKLY_TASK_ID],
    })
    const result = reducer(store, setTaskHidden(DAILY_TASK_ID, false))
    expect(result.hiddenTaskIds).toEqual([WEEKLY_TASK_ID])
  })

  it('is a no-op when hiding a task that is already hidden', () => {
    const store = storeWithCharacter({ hiddenTaskIds: [DAILY_TASK_ID] })
    const result = reducer(store, setTaskHidden(DAILY_TASK_ID, true))
    expect(result).toBe(store)
  })

  it('is a no-op when unhiding a task that is not hidden', () => {
    const store = emptyStore()
    const result = reducer(store, setTaskHidden(DAILY_TASK_ID, false))
    expect(result).toBe(store)
  })
})

describe('reducer / setTaskDetailedCount', () => {
  it('adds a taskId to detailedCountTaskIds when enabling detailed count display', () => {
    const store = emptyStore()
    const result = reducer(store, setTaskDetailedCount(DAILY_TASK_ID, true))
    expect(result.detailedCountTaskIds).toEqual([DAILY_TASK_ID])
  })

  it('removes a taskId from detailedCountTaskIds when disabling detailed count display', () => {
    const store = storeWithCharacter({
      detailedCountTaskIds: [DAILY_TASK_ID],
    })
    const result = reducer(store, setTaskDetailedCount(DAILY_TASK_ID, false))
    expect(result.detailedCountTaskIds).toEqual([])
  })

  it('preserves other detailed count ids untouched', () => {
    const store = storeWithCharacter({
      detailedCountTaskIds: [DAILY_TASK_ID, WEEKLY_TASK_ID],
    })
    const result = reducer(store, setTaskDetailedCount(DAILY_TASK_ID, false))
    expect(result.detailedCountTaskIds).toEqual([WEEKLY_TASK_ID])
  })

  it('is a no-op when enabling detailed count display for a task that already has it enabled', () => {
    const store = storeWithCharacter({
      detailedCountTaskIds: [DAILY_TASK_ID],
    })
    const result = reducer(store, setTaskDetailedCount(DAILY_TASK_ID, true))
    expect(result).toBe(store)
  })

  it('is a no-op when disabling detailed count display for a task that does not have it enabled', () => {
    const store = emptyStore()
    const result = reducer(store, setTaskDetailedCount(DAILY_TASK_ID, false))
    expect(result).toBe(store)
  })
})

describe('reducer / addCustomTask', () => {
  it('appends a custom task with a generated id', () => {
    const store = emptyStore()
    const result = reducer(
      store,
      addCustomTask('  ギルドクエスト  ', 'blue', 3, 'daily'),
    )
    expect(result.customTasks).toHaveLength(1)
    const task = result.customTasks?.[0]
    expect(task?.name).toBe('ギルドクエスト')
    expect(task?.color).toBe('blue')
    expect(task?.maxProgress).toBe(3)
    expect(task?.category).toBe('daily')
    expect(task?.id).toMatch(/^custom_[a-z0-9_]+$/)
  })

  it('generates distinct ids for successive custom tasks', () => {
    const store = emptyStore()
    const first = reducer(store, addCustomTask('Task A', 'blue', 1, 'daily'))
    const second = reducer(first, addCustomTask('Task B', 'green', 1, 'weekly'))
    expect(second.customTasks).toHaveLength(2)
    expect(second.customTasks?.[0].id).not.toBe(second.customTasks?.[1].id)
  })

  it('rejects an empty (or whitespace-only) name', () => {
    const store = emptyStore()
    const result = reducer(store, addCustomTask('   ', 'blue', 1, 'milestone'))
    expect(result).toBe(store)
  })

  it('rejects a name longer than 50 characters', () => {
    const store = emptyStore()
    const result = reducer(
      store,
      addCustomTask('a'.repeat(51), 'blue', 1, 'daily'),
    )
    expect(result).toBe(store)
  })

  it.each([
    [0, false],
    [1, true],
    [1000, true],
    [1001, false],
    [1.5, false],
  ] as const)('maxProgress %s accepted: %s', (maxProgress, expected) => {
    const store = emptyStore()
    const result = reducer(
      store,
      addCustomTask('Task', 'blue', maxProgress, 'daily'),
    )
    if (expected) {
      expect(result.customTasks).toHaveLength(1)
    } else {
      expect(result).toBe(store)
    }
  })

  it('rejects adding beyond MAX_CUSTOM_TASKS', () => {
    const customTasks = Array.from({ length: MAX_CUSTOM_TASKS }, (_, index) =>
      buildCustomTask({ id: `custom_limit_${index}`, category: 'daily' }),
    )
    const store = storeWithCharacter({ customTasks })
    const result = reducer(store, addCustomTask('Task', 'blue', 1, 'daily'))
    expect(result).toBe(store)
  })
})

describe('reducer / updateCustomTask', () => {
  it('updates every field of an existing custom task', () => {
    const withTask = reducer(
      emptyStore(),
      addCustomTask('Original', 'blue', 1, 'daily'),
    )
    const id = withTask.customTasks?.[0].id as string
    const result = reducer(
      withTask,
      updateCustomTask(id, 'Renamed', 'green', 5, 'weekly'),
    )
    expect(result.customTasks?.[0]).toEqual({
      id,
      name: 'Renamed',
      color: 'green',
      maxProgress: 5,
      category: 'weekly',
    })
  })

  it('is a no-op when the custom task does not exist', () => {
    const store = emptyStore()
    const result = reducer(
      store,
      updateCustomTask('missing', 'Renamed', 'green', 5, 'weekly'),
    )
    expect(result).toBe(store)
  })

  it('is a no-op when the new name is empty after trim', () => {
    const withTask = reducer(
      emptyStore(),
      addCustomTask('Original', 'blue', 1, 'daily'),
    )
    const id = withTask.customTasks?.[0].id as string
    const result = reducer(
      withTask,
      updateCustomTask(id, '   ', 'green', 5, 'weekly'),
    )
    expect(result).toBe(withTask)
  })

  it('is a no-op when maxProgress is out of range', () => {
    const withTask = reducer(
      emptyStore(),
      addCustomTask('Original', 'blue', 1, 'daily'),
    )
    const id = withTask.customTasks?.[0].id as string
    const result = reducer(
      withTask,
      updateCustomTask(id, 'Renamed', 'green', 1001, 'weekly'),
    )
    expect(result).toBe(withTask)
  })

  it('updates only the targeted task when multiple custom tasks exist', () => {
    const withTasks = [
      addCustomTask('Task A', 'blue', 1, 'daily'),
      addCustomTask('Task B', 'green', 2, 'weekly'),
    ].reduce((store, action) => reducer(store, action), emptyStore())
    const [taskA, taskB] = withTasks.customTasks ?? []

    const result = reducer(
      withTasks,
      updateCustomTask(taskA.id, 'Renamed', 'gold', 5, 'milestone'),
    )

    expect(result.customTasks).toEqual([
      {
        id: taskA.id,
        name: 'Renamed',
        color: 'gold',
        maxProgress: 5,
        category: 'milestone',
      },
      taskB,
    ])
  })
})

describe('reducer / removeCustomTask', () => {
  it('removes the custom task and cleans up its progress entries across characters', () => {
    const withTask = reducer(
      emptyStore(),
      addCustomTask('Original', 'blue', 1, 'daily'),
    )
    const id = withTask.customTasks?.[0].id as string
    const withProgress: typeof withTask = {
      ...withTask,
      progress: {
        'char-1': { [id]: 1, [DAILY_TASK_ID]: 2 },
        'char-2': { [id]: 3 },
      },
    }
    const result = reducer(withProgress, removeCustomTask(id))

    expect(result.customTasks).toEqual([])
    expect(result.progress).toEqual({
      'char-1': { [DAILY_TASK_ID]: 2 },
      'char-2': {},
    })
  })

  it('is a no-op when the custom task does not exist', () => {
    const store = emptyStore()
    expect(reducer(store, removeCustomTask('missing'))).toBe(store)
  })

  it('does not remove or affect other custom tasks when multiple exist', () => {
    const withTasks = [
      addCustomTask('Task A', 'blue', 1, 'daily'),
      addCustomTask('Task B', 'green', 2, 'weekly'),
    ].reduce((store, action) => reducer(store, action), emptyStore())
    const [taskA, taskB] = withTasks.customTasks ?? []
    const withProgress: typeof withTasks = {
      ...withTasks,
      progress: { 'char-1': { [taskA.id]: 1, [taskB.id]: 2 } },
    }

    const result = reducer(withProgress, removeCustomTask(taskA.id))

    expect(result.customTasks).toEqual([taskB])
    expect(result.progress).toEqual({ 'char-1': { [taskB.id]: 2 } })
  })

  it('removes the task id from taskOrder, hiddenTaskIds, and detailedCountTaskIds', () => {
    const withTasks = [
      addCustomTask('Task A', 'blue', 1, 'daily'),
      addCustomTask('Task B', 'green', 2, 'daily'),
    ].reduce((store, action) => reducer(store, action), emptyStore())
    const [taskA, taskB] = withTasks.customTasks ?? []
    const withOrderAndFlags: typeof withTasks = {
      ...withTasks,
      taskOrder: {
        daily: [...DAILY_TASK_IDS, taskA.id, taskB.id],
        weekly: [WEEKLY_TASK_ID],
      },
      hiddenTaskIds: [taskA.id, DAILY_TASK_ID],
      detailedCountTaskIds: [taskA.id, WEEKLY_TASK_ID],
    }

    const result = reducer(withOrderAndFlags, removeCustomTask(taskA.id))

    expect(result.taskOrder).toEqual({
      daily: [...DAILY_TASK_IDS, taskB.id],
      weekly: [WEEKLY_TASK_ID],
    })
    expect(result.hiddenTaskIds).toEqual([DAILY_TASK_ID])
    expect(result.detailedCountTaskIds).toEqual([WEEKLY_TASK_ID])
  })
})

describe('reducer / evaluateResetState', () => {
  it('initializes resetState on first evaluation without deleting anything', () => {
    const store = storeWithCharacter({
      progress: { 'char-1': { [DAILY_TASK_ID]: 2 } },
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.resetState).toEqual({
      daily: '2026-02-03T20:00:00.000Z',
      weekly: '2026-02-01T20:00:00.000Z',
    })
    expect(result.progress).toEqual(store.progress)
  })

  it('returns the same store reference when already at the current period', () => {
    const now = new Date('2026-02-04T10:00:00.000Z')
    const store = storeWithCharacter({
      resetState: {
        daily: '2026-02-03T20:00:00.000Z',
        weekly: '2026-02-01T20:00:00.000Z',
      },
    })
    expect(evaluateResetState(store, now)).toBe(store)
  })

  it('deletes daily-category entries once the stored daily period is in the past', () => {
    const store = storeWithCharacter({
      resetState: {
        daily: '2026-02-02T20:00:00.000Z',
        weekly: '2026-02-01T20:00:00.000Z',
      },
      progress: {
        'char-1': { [DAILY_TASK_ID]: 2, [WEEKLY_TASK_ID]: 1 },
      },
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.progress['char-1']).toEqual({ [WEEKLY_TASK_ID]: 1 })
    expect(result.resetState).toEqual({
      daily: '2026-02-03T20:00:00.000Z',
      weekly: '2026-02-01T20:00:00.000Z',
    })
  })

  it('deletes weekly-category entries once the stored weekly period is in the past', () => {
    const store = storeWithCharacter({
      resetState: {
        daily: '2026-02-03T20:00:00.000Z',
        weekly: '2026-01-25T20:00:00.000Z',
      },
      progress: {
        'char-1': { [DAILY_TASK_ID]: 2, [WEEKLY_TASK_ID]: 1 },
      },
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.progress['char-1']).toEqual({ [DAILY_TASK_ID]: 2 })
  })

  it('deletes both daily- and weekly-category entries when both stored periods are in the past', () => {
    const store = storeWithCharacter({
      resetState: {
        daily: '2026-02-02T20:00:00.000Z',
        weekly: '2026-01-25T20:00:00.000Z',
      },
      progress: {
        'char-1': { [DAILY_TASK_ID]: 2, [WEEKLY_TASK_ID]: 1 },
      },
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.progress['char-1']).toEqual({})
    expect(result.resetState).toEqual({
      daily: '2026-02-03T20:00:00.000Z',
      weekly: '2026-02-01T20:00:00.000Z',
    })
  })

  it('does not delete anything when the stored period is in the future (clock rollback)', () => {
    const store = storeWithCharacter({
      resetState: {
        daily: '2999-01-01T20:00:00.000Z',
        weekly: '2999-01-01T20:00:00.000Z',
      },
      progress: {
        'char-1': { [DAILY_TASK_ID]: 2, [WEEKLY_TASK_ID]: 1 },
      },
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.progress['char-1']).toEqual({
      [DAILY_TASK_ID]: 2,
      [WEEKLY_TASK_ID]: 1,
    })
    expect(result.resetState).toEqual({
      daily: '2026-02-03T20:00:00.000Z',
      weekly: '2026-02-01T20:00:00.000Z',
    })
  })

  it('treats an invalid stored period string as absent (re-init without delete)', () => {
    const store = storeWithCharacter({
      resetState: {
        daily: 'not-a-date',
        weekly: '2026-02-01T20:00:00.000Z',
      },
      progress: { 'char-1': { [DAILY_TASK_ID]: 2 } },
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.progress['char-1']).toEqual({ [DAILY_TASK_ID]: 2 })
  })

  it('leaves progress for an unknown taskId untouched but still advances resetState', () => {
    const store = storeWithCharacter({
      resetState: {
        daily: '2026-02-02T20:00:00.000Z',
        weekly: '2026-02-01T20:00:00.000Z',
      },
      progress: { 'char-1': { unknown_task: 3 } },
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.progress['char-1']).toEqual({ unknown_task: 3 })
    expect(result.resetState).toEqual({
      daily: '2026-02-03T20:00:00.000Z',
      weekly: '2026-02-01T20:00:00.000Z',
    })
  })

  it('resets across all characters and preserves the reference of characters with nothing to reset', () => {
    let store = reducer(emptyStore(), addCharacter('Alice'))
    store = reducer(store, addCharacter('Bob'))
    const [alice, bob] = store.characters
    store = {
      ...store,
      resetState: {
        daily: '2026-02-02T20:00:00.000Z',
        weekly: '2026-02-01T20:00:00.000Z',
      },
      progress: {
        [alice.id]: { [DAILY_TASK_ID]: 2 },
        [bob.id]: { [WEEKLY_TASK_ID]: 1 },
      },
    }
    const bobProgressBefore = store.progress[bob.id]
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.progress[alice.id]).toEqual({})
    expect(result.progress[bob.id]).toBe(bobProgressBefore)
  })

  it('resets a daily custom task progress when the stored daily period is in the past', () => {
    const store = storeWithCharacter({
      resetState: {
        daily: '2026-02-02T20:00:00.000Z',
        weekly: '2026-02-01T20:00:00.000Z',
      },
      progress: { 'char-1': { custom_daily_task: 2 } },
      customTasks: [
        {
          id: 'custom_daily_task',
          name: 'Custom Daily',
          color: 'blue',
          maxProgress: 3,
          category: 'daily',
        },
      ],
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.progress['char-1']).toEqual({})
  })

  it('resets a weekly custom task progress when the stored weekly period is in the past', () => {
    const store = storeWithCharacter({
      resetState: {
        daily: '2026-02-03T20:00:00.000Z',
        weekly: '2026-01-25T20:00:00.000Z',
      },
      progress: { 'char-1': { custom_weekly_task: 2 } },
      customTasks: [
        {
          id: 'custom_weekly_task',
          name: 'Custom Weekly',
          color: 'blue',
          maxProgress: 3,
          category: 'weekly',
        },
      ],
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.progress['char-1']).toEqual({})
  })

  it('never resets a milestone custom task progress', () => {
    const store = storeWithCharacter({
      resetState: {
        daily: '2026-02-02T20:00:00.000Z',
        weekly: '2026-01-25T20:00:00.000Z',
      },
      progress: { 'char-1': { custom_milestone_task: 2 } },
      customTasks: [
        {
          id: 'custom_milestone_task',
          name: 'Custom Milestone',
          color: 'blue',
          maxProgress: 3,
          category: 'milestone',
        },
      ],
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.progress['char-1']).toEqual({ custom_milestone_task: 2 })
  })
})

describe('reducer / evaluateReset action', () => {
  it('applies the same evaluation as evaluateResetState through the reducer', () => {
    const store = storeWithCharacter({
      resetState: {
        daily: '2026-02-02T20:00:00.000Z',
        weekly: '2026-02-01T20:00:00.000Z',
      },
      progress: { 'char-1': { [DAILY_TASK_ID]: 2 } },
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = reducer(store, evaluateReset(now))

    expect(result.progress['char-1']).toEqual({})
  })
})

describe('reducer / setProgress reset evaluation', () => {
  it('does not lose a write made right at the daily reset boundary', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-04T10:00:00.000Z'))

    const store = storeWithCharacter({
      resetState: {
        daily: '2026-02-02T20:00:00.000Z',
        weekly: '2026-02-01T20:00:00.000Z',
      },
      progress: { 'char-1': { [DAILY_TASK_ID]: 2 } },
    })

    const result = reducer(store, setProgress('char-1', DAILY_TASK_ID, 1))

    expect(result.progress['char-1']).toEqual({ [DAILY_TASK_ID]: 1 })
    expect(result.resetState).toEqual({
      daily: '2026-02-03T20:00:00.000Z',
      weekly: '2026-02-01T20:00:00.000Z',
    })
  })
})
