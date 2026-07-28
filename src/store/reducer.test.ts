import { describe, expect, it, vi } from 'vitest'
import upstreamTasksDocument from '../data/upstreamTasks.json'
import { emptyStore, storeWithCharacter } from '../test/fixtures'
import {
  addCharacter,
  duplicateCharacter,
  evaluateReset,
  removeCharacter,
  renameCharacter,
  setProgress,
} from './actions'
import { evaluateResetState, reducer } from './reducer'

const DAILY_TASK_ID = upstreamTasksDocument.daily[0].id
const WEEKLY_TASK_ID = upstreamTasksDocument.weekly[0].id

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

describe('reducer / evaluateResetState', () => {
  it('initializes resetState on first evaluation without deleting anything', () => {
    const store = storeWithCharacter({
      progress: { 'char-1': { [DAILY_TASK_ID]: 2 } },
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.resetState).toEqual({
      dailyPeriodStart: '2026-02-03T20:00:00.000Z',
      weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
    })
    expect(result.progress).toEqual(store.progress)
  })

  it('returns the same store reference when already at the current period', () => {
    const now = new Date('2026-02-04T10:00:00.000Z')
    const store = storeWithCharacter({
      resetState: {
        dailyPeriodStart: '2026-02-03T20:00:00.000Z',
        weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
      },
    })
    expect(evaluateResetState(store, now)).toBe(store)
  })

  it('deletes daily-category entries once the stored daily period is in the past', () => {
    const store = storeWithCharacter({
      resetState: {
        dailyPeriodStart: '2026-02-02T20:00:00.000Z',
        weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
      },
      progress: {
        'char-1': { [DAILY_TASK_ID]: 2, [WEEKLY_TASK_ID]: 1 },
      },
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.progress['char-1']).toEqual({ [WEEKLY_TASK_ID]: 1 })
    expect(result.resetState).toEqual({
      dailyPeriodStart: '2026-02-03T20:00:00.000Z',
      weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
    })
  })

  it('deletes weekly-category entries once the stored weekly period is in the past', () => {
    const store = storeWithCharacter({
      resetState: {
        dailyPeriodStart: '2026-02-03T20:00:00.000Z',
        weeklyPeriodStart: '2026-01-25T20:00:00.000Z',
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
        dailyPeriodStart: '2026-02-02T20:00:00.000Z',
        weeklyPeriodStart: '2026-01-25T20:00:00.000Z',
      },
      progress: {
        'char-1': { [DAILY_TASK_ID]: 2, [WEEKLY_TASK_ID]: 1 },
      },
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.progress['char-1']).toEqual({})
    expect(result.resetState).toEqual({
      dailyPeriodStart: '2026-02-03T20:00:00.000Z',
      weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
    })
  })

  it('does not delete anything when the stored period is in the future (clock rollback)', () => {
    const store = storeWithCharacter({
      resetState: {
        dailyPeriodStart: '2999-01-01T20:00:00.000Z',
        weeklyPeriodStart: '2999-01-01T20:00:00.000Z',
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
      dailyPeriodStart: '2026-02-03T20:00:00.000Z',
      weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
    })
  })

  it('treats an invalid stored period string as absent (re-init without delete)', () => {
    const store = storeWithCharacter({
      resetState: {
        dailyPeriodStart: 'not-a-date',
        weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
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
        dailyPeriodStart: '2026-02-02T20:00:00.000Z',
        weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
      },
      progress: { 'char-1': { unknown_task: 3 } },
    })
    const now = new Date('2026-02-04T10:00:00.000Z')
    const result = evaluateResetState(store, now)

    expect(result.progress['char-1']).toEqual({ unknown_task: 3 })
    expect(result.resetState).toEqual({
      dailyPeriodStart: '2026-02-03T20:00:00.000Z',
      weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
    })
  })

  it('resets across all characters and preserves the reference of characters with nothing to reset', () => {
    let store = reducer(emptyStore(), addCharacter('Alice'))
    store = reducer(store, addCharacter('Bob'))
    const [alice, bob] = store.characters
    store = {
      ...store,
      resetState: {
        dailyPeriodStart: '2026-02-02T20:00:00.000Z',
        weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
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
})

describe('reducer / evaluateReset action', () => {
  it('applies the same evaluation as evaluateResetState through the reducer', () => {
    const store = storeWithCharacter({
      resetState: {
        dailyPeriodStart: '2026-02-02T20:00:00.000Z',
        weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
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
        dailyPeriodStart: '2026-02-02T20:00:00.000Z',
        weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
      },
      progress: { 'char-1': { [DAILY_TASK_ID]: 2 } },
    })

    const result = reducer(store, setProgress('char-1', DAILY_TASK_ID, 1))

    expect(result.progress['char-1']).toEqual({ [DAILY_TASK_ID]: 1 })
    expect(result.resetState).toEqual({
      dailyPeriodStart: '2026-02-03T20:00:00.000Z',
      weeklyPeriodStart: '2026-02-01T20:00:00.000Z',
    })
  })
})
