import { describe, expect, it, vi } from 'vitest'
import { storeWithCharacter } from '../test/fixtures'
import {
  BACKUP_STORAGE_KEY,
  RESET_BACKUP_STORAGE_KEY,
  STORAGE_KEY,
  backupCorruptedStore,
  backupResetSnapshot,
  diffRemovedProgress,
  loadStore,
  saveStore,
} from './persistence'

const sampleStore = () =>
  storeWithCharacter({ progress: { 'char-1': { daily_a: 2 } } })

describe('loadStore', () => {
  it('returns an empty store when nothing is stored', () => {
    const result = loadStore()
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.characters).toEqual([])
      expect(result.store.progress).toEqual({})
    }
  })

  it('round-trips a valid store through save and load', () => {
    const store = sampleStore()
    const saveResult = saveStore(store)
    expect(saveResult.status).toBe('ok')

    const loadResult = loadStore()
    expect(loadResult.status).toBe('ok')
    if (loadResult.status === 'ok') {
      expect(loadResult.store).toEqual(store)
    }
  })

  it('recovers with the corrupted raw value when the stored value is not valid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')

    const result = loadStore()

    expect(result.status).toBe('recovered')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{not valid json')
    if (result.status === 'recovered') {
      expect(result.corruptedRaw).toBe('{not valid json')
      expect(result.store.characters).toEqual([])
    }
  })

  it('recovers with the corrupted raw value when the top-level schema does not match', () => {
    const raw = JSON.stringify({ foo: 'bar' })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('recovered')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw)
    if (result.status === 'recovered') {
      expect(result.corruptedRaw).toBe(raw)
    }
  })

  it('partially rescues characters, keeping only the valid elements', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [
        { id: 'char-1', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z' },
        { id: 'char-2', name: '' },
        'not-an-object',
      ],
      progress: {},
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.characters).toHaveLength(1)
      expect(result.store.characters[0].id).toBe('char-1')
    }
  })

  it('tolerates and preserves unknown top-level keys (forward compatibility)', () => {
    const raw = JSON.stringify({
      schemaVersion: 2,
      taskDataVersion: 'commit-2',
      characters: [],
      progress: {},
      someFutureField: 'value',
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.schemaVersion).toBe(2)
      expect(
        (result.store as unknown as Record<string, unknown>).someFutureField,
      ).toBe('value')
    }
  })

  it('drops progress entries belonging to characters that were dropped or never existed', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [
        { id: 'char-1', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      progress: {
        'char-1': { daily_a: 2 },
        'char-2': { daily_a: 1 },
      },
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.progress).toEqual({ 'char-1': { daily_a: 2 } })
    }
  })

  it('drops invalid progress values (negative or non-integer) while keeping valid ones', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [
        { id: 'char-1', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      progress: {
        'char-1': { daily_a: -1, daily_b: 1.5, daily_c: 3 },
      },
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.progress).toEqual({ 'char-1': { daily_c: 3 } })
    }
  })

  it('deduplicates characters sharing the same id, keeping the first occurrence', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [
        { id: 'char-1', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z' },
        {
          id: 'char-1',
          name: 'Duplicate',
          createdAt: '2026-01-02T00:00:00.000Z',
        },
      ],
      progress: {},
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.characters).toHaveLength(1)
      expect(result.store.characters[0].name).toBe('Alice')
    }
  })

  it('rejects a character whose id is an unsafe object key', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [
        {
          id: '__proto__',
          name: 'Evil',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        { id: 'char-1', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      progress: {},
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.characters).toHaveLength(1)
      expect(result.store.characters[0].id).toBe('char-1')
    }
  })

  it('drops progress entries keyed by an unsafe object key', () => {
    // Built as a raw JSON string (not a JS object literal) so that
    // "__proto__" becomes a genuine own key instead of setting the
    // object's prototype.
    const raw =
      '{"schemaVersion":1,"taskDataVersion":"commit-1",' +
      '"characters":[{"id":"char-1","name":"Alice","createdAt":"2026-01-01T00:00:00.000Z"}],' +
      '"progress":{"char-1":{"__proto__":3,"constructor":4,"daily_a":2}}}'
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.progress).toEqual({ 'char-1': { daily_a: 2 } })
    }
  })

  it('drops unknown top-level keys that are unsafe object keys', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [],
      progress: {},
      constructor: 'value',
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(
        Object.prototype.hasOwnProperty.call(result.store, 'constructor'),
      ).toBe(false)
    }
  })

  it('rejects a restored character name longer than 50 characters', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [
        {
          id: 'char-1',
          name: 'a'.repeat(51),
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      progress: {},
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.characters).toHaveLength(0)
    }
  })

  it('returns a readonly state when localStorage.getItem throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })

    const result = loadStore()

    expect(result.status).toBe('readonly')
  })

  it('round-trips a valid resetState through save and load', () => {
    const store = storeWithCharacter({
      progress: {},
      resetState: {
        dailyPeriodStart: '2026-01-01T19:00:00.000Z',
        weeklyPeriodStart: '2025-12-28T19:00:00.000Z',
      },
    })
    const saveResult = saveStore(store)
    expect(saveResult.status).toBe('ok')

    const loadResult = loadStore()
    expect(loadResult.status).toBe('ok')
    if (loadResult.status === 'ok') {
      expect(loadResult.store.resetState).toEqual(store.resetState)
    }
  })

  it('omits resetState entirely when it was never stored', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [],
      progress: {},
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.resetState).toBeUndefined()
    }
  })

  it('falls back to an absent resetState (without wiping the rest of the store) when dailyPeriodStart is not a valid date string', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [
        { id: 'char-1', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      progress: { 'char-1': { daily_a: 2 } },
      resetState: {
        dailyPeriodStart: 'not-a-date',
        weeklyPeriodStart: '2025-12-28T19:00:00.000Z',
      },
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.resetState).toBeUndefined()
      expect(result.store.characters).toHaveLength(1)
      expect(result.store.progress).toEqual({ 'char-1': { daily_a: 2 } })
    }
  })

  it('falls back to an absent resetState when a required field is missing', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [],
      progress: {},
      resetState: { dailyPeriodStart: '2026-01-01T19:00:00.000Z' },
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.resetState).toBeUndefined()
    }
  })

  it('round-trips a valid taskOrder through save and load', () => {
    const store = storeWithCharacter({
      progress: {},
      taskOrder: { daily: ['daily_b', 'daily_a'], weekly: ['weekly_a'] },
    })
    const saveResult = saveStore(store)
    expect(saveResult.status).toBe('ok')

    const loadResult = loadStore()
    expect(loadResult.status).toBe('ok')
    if (loadResult.status === 'ok') {
      expect(loadResult.store.taskOrder).toEqual(store.taskOrder)
    }
  })

  it('omits taskOrder entirely when it was never stored', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [],
      progress: {},
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.taskOrder).toBeUndefined()
    }
  })

  it('falls back to an absent taskOrder (without wiping the rest of the store) when a field holds the wrong type', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [
        { id: 'char-1', name: 'Alice', createdAt: '2026-01-01T00:00:00.000Z' },
      ],
      progress: { 'char-1': { daily_a: 2 } },
      taskOrder: { daily: 42, weekly: ['weekly_a'] },
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.taskOrder).toBeUndefined()
      expect(result.store.characters).toHaveLength(1)
      expect(result.store.progress).toEqual({ 'char-1': { daily_a: 2 } })
    }
  })

  it('falls back to an absent taskOrder when an array element is not a string', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [],
      progress: {},
      taskOrder: { daily: ['daily_a', 3], weekly: [] },
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.taskOrder).toBeUndefined()
    }
  })

  it('falls back to an absent taskOrder when it is a bare array instead of a { daily, weekly } object', () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [],
      progress: {},
      taskOrder: ['daily_a', 'daily_b'],
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.taskOrder).toBeUndefined()
    }
  })

  it("preserves a well-formed resetState even when it points to a future period (filtering is the reducer's responsibility, not persistence)", () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      taskDataVersion: 'commit-1',
      characters: [],
      progress: {},
      resetState: {
        dailyPeriodStart: '2999-01-01T19:00:00.000Z',
        weeklyPeriodStart: '2999-01-01T19:00:00.000Z',
      },
    })
    localStorage.setItem(STORAGE_KEY, raw)

    const result = loadStore()

    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.store.resetState).toEqual({
        dailyPeriodStart: '2999-01-01T19:00:00.000Z',
        weeklyPeriodStart: '2999-01-01T19:00:00.000Z',
      })
    }
  })
})

describe('backupCorruptedStore', () => {
  it('writes the corrupted raw value to the backup key', () => {
    const result = backupCorruptedStore('{not valid json')

    expect(result.status).toBe('ok')
    expect(localStorage.getItem(BACKUP_STORAGE_KEY)).toBe('{not valid json')
  })

  it('reports a failure without touching the primary key when the backup write fails', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json')

    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation((key) => {
        if (key === BACKUP_STORAGE_KEY) {
          throw new Error('QuotaExceededError')
        }
      })

    const result = backupCorruptedStore('{not valid json')

    expect(result.status).toBe('error')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('{not valid json')
    expect(setItemSpy).toHaveBeenCalled()
  })
})

describe('saveStore', () => {
  it('reports a failure when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    const result = saveStore(sampleStore())
    expect(result.status).toBe('error')
  })
})

describe('backupResetSnapshot', () => {
  it('writes the removed progress under the reset backup key, alongside a backedUpAt timestamp', () => {
    const removedProgress = { 'char-1': { daily_a: 2 } }

    const result = backupResetSnapshot(removedProgress)

    expect(result.status).toBe('ok')
    const stored = JSON.parse(
      localStorage.getItem(RESET_BACKUP_STORAGE_KEY) ?? 'null',
    )
    expect(stored.progress).toEqual(removedProgress)
    expect(typeof stored.backedUpAt).toBe('string')
    expect(Number.isNaN(Date.parse(stored.backedUpAt))).toBe(false)
  })

  it('reports a failure without throwing when localStorage.setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    const result = backupResetSnapshot({ 'char-1': { daily_a: 2 } })

    expect(result.status).toBe('error')
  })
})

describe('diffRemovedProgress', () => {
  it('returns the tasks that are present in the previous progress but missing in the next', () => {
    const previous = { 'char-1': { daily_a: 2, daily_b: 1 } }
    const next = { 'char-1': { daily_b: 1 } }

    expect(diffRemovedProgress(previous, next)).toEqual({
      'char-1': { daily_a: 2 },
    })
  })

  it('returns an empty object when no tasks were removed', () => {
    const previous = { 'char-1': { daily_a: 2 } }
    const next = { 'char-1': { daily_a: 2, daily_b: 1 } }

    expect(diffRemovedProgress(previous, next)).toEqual({})
  })

  it('treats a character missing entirely from the next progress as having all its tasks removed', () => {
    const previous = { 'char-1': { daily_a: 2, daily_b: 1 } }
    const next = {}

    expect(diffRemovedProgress(previous, next)).toEqual({
      'char-1': { daily_a: 2, daily_b: 1 },
    })
  })

  it('returns an empty object when both progress objects are empty', () => {
    expect(diffRemovedProgress({}, {})).toEqual({})
  })

  it('drops entries keyed by an unsafe object key', () => {
    // Built via JSON.parse of a raw string (not a JS object literal) so
    // that "__proto__" becomes a genuine own key instead of setting the
    // object's prototype.
    const previous = JSON.parse(
      '{"__proto__":{"daily_a":2},"constructor":{"daily_a":2},' +
        '"char-1":{"__proto__":3,"constructor":4,"daily_a":2}}',
    )
    const next = {}

    expect(diffRemovedProgress(previous, next)).toEqual({
      'char-1': { daily_a: 2 },
    })
  })
})
