import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CHARACTER, storeWithCharacter } from '../test/fixtures'
import { IMPORT_BACKUP_STORAGE_KEY, STORAGE_KEY } from './persistence'
import { THEME_STORAGE_KEY } from './theme'
import {
  EXPORT_VERSION,
  INVALID_JSON_MESSAGE,
  INVALID_STORE_MESSAGE,
  MAX_IMPORT_CHARACTERS,
  MAX_IMPORT_HIDDEN_TASK_IDS,
  MAX_IMPORT_TASK_ORDER_ENTRIES,
  MAX_IMPORT_TASKS_PER_CHARACTER,
  SUPPORTED_STORE_SCHEMA_VERSION,
  TOO_MANY_ELEMENTS_MESSAGE,
  UNSUPPORTED_SCHEMA_VERSION_MESSAGE,
  UNSUPPORTED_VERSION_MESSAGE,
  applyBackup,
  backupFileName,
  buildBackupEnvelope,
  parseBackupFile,
  serializeBackupEnvelope,
} from './backup'

describe('buildBackupEnvelope', () => {
  it('builds an envelope with the given version, timestamp, theme, and store', () => {
    const store = storeWithCharacter()
    const now = new Date('2026-08-03T12:00:00.000Z')
    const envelope = buildBackupEnvelope(store, 'dark', now)
    expect(envelope).toEqual({
      version: EXPORT_VERSION,
      exportedAt: '2026-08-03T12:00:00.000Z',
      theme: 'dark',
      store,
    })
  })

  it('accepts a null theme for a system-following preference', () => {
    const envelope = buildBackupEnvelope(
      storeWithCharacter(),
      null,
      new Date('2026-08-03T12:00:00.000Z'),
    )
    expect(envelope.theme).toBeNull()
  })
})

describe('backupFileName', () => {
  it('pads single-digit month and day', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe(
      'bpsr-checklist-backup-2026-01-05.json',
    )
  })

  it('does not pad double-digit month and day', () => {
    expect(backupFileName(new Date(2026, 10, 23))).toBe(
      'bpsr-checklist-backup-2026-11-23.json',
    )
  })
})

describe('serializeBackupEnvelope / parseBackupFile round trip', () => {
  it('parses a serialized envelope back into an equivalent backup', () => {
    const store = storeWithCharacter()
    const envelope = buildBackupEnvelope(
      store,
      'light',
      new Date('2026-08-03T12:00:00.000Z'),
    )
    const result = parseBackupFile(serializeBackupEnvelope(envelope))
    expect(result).toEqual({
      status: 'ok',
      backup: { theme: 'light', storeData: store },
    })
  })
})

describe('parseBackupFile / envelope-level validation', () => {
  it.each([
    ['a file that is not valid JSON', '{not valid json', INVALID_JSON_MESSAGE],
    ['a JSON value that is not an object', '[1, 2, 3]', INVALID_STORE_MESSAGE],
    [
      'an envelope whose version does not match EXPORT_VERSION',
      JSON.stringify({
        ...buildBackupEnvelope(
          storeWithCharacter(),
          null,
          new Date('2026-08-03T12:00:00.000Z'),
        ),
        version: 2,
      }),
      UNSUPPORTED_VERSION_MESSAGE,
    ],
    [
      'an envelope missing the store field',
      JSON.stringify({
        version: EXPORT_VERSION,
        exportedAt: '2026-08-03T12:00:00.000Z',
        theme: null,
      }),
      INVALID_STORE_MESSAGE,
    ],
    [
      'an envelope whose store fails the top-level StoreSchema parse',
      JSON.stringify({
        version: EXPORT_VERSION,
        exportedAt: '2026-08-03T12:00:00.000Z',
        theme: null,
        store: { schemaVersion: 1, characters: 'not-an-array' },
      }),
      INVALID_STORE_MESSAGE,
    ],
    [
      'an envelope whose store.schemaVersion exceeds the supported version',
      JSON.stringify({
        ...buildBackupEnvelope(
          storeWithCharacter(),
          null,
          new Date('2026-08-03T12:00:00.000Z'),
        ),
        store: {
          ...storeWithCharacter(),
          schemaVersion: SUPPORTED_STORE_SCHEMA_VERSION + 1,
        },
      }),
      UNSUPPORTED_SCHEMA_VERSION_MESSAGE,
    ],
  ])('rejects %s', (_description, raw, message) => {
    expect(parseBackupFile(raw)).toEqual({ status: 'error', message })
  })

  it('ignores an invalid theme value without failing the whole import', () => {
    const envelope = buildBackupEnvelope(
      storeWithCharacter(),
      null,
      new Date('2026-08-03T12:00:00.000Z'),
    )
    const raw = JSON.stringify({ ...envelope, theme: 'blue' })
    const result = parseBackupFile(raw)
    expect(result.status).toBe('ok')
    expect(result.status === 'ok' && result.backup.theme).toBeNull()
  })

  it('strips unsafe object keys from the normalized store data', () => {
    const raw = JSON.stringify({
      version: EXPORT_VERSION,
      exportedAt: '2026-08-03T12:00:00.000Z',
      theme: null,
      store: {
        schemaVersion: 1,
        taskDataVersion: 'test-commit',
        characters: [
          {
            id: '__proto__',
            name: 'Evil',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        progress: {},
      },
    })
    const result = parseBackupFile(raw)
    expect(result.status).toBe('ok')
    expect(
      result.status === 'ok' && result.backup.storeData.characters,
    ).toEqual([])
  })
})

describe('parseBackupFile / import size limits', () => {
  const buildCharacters = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      id: `char-${index}`,
      name: `Character ${index}`,
      createdAt: '2026-01-01T00:00:00.000Z',
    }))

  const buildTasks = (count: number): Record<string, number> =>
    Object.fromEntries(
      Array.from({ length: count }, (_, index) => [`task-${index}`, 0]),
    )

  const buildRaw = (store: Record<string, unknown>): string =>
    JSON.stringify({
      version: EXPORT_VERSION,
      exportedAt: '2026-08-03T00:00:00.000Z',
      theme: null,
      store: { schemaVersion: 1, taskDataVersion: 'test-commit', ...store },
    })

  it('rejects a store with more characters than MAX_IMPORT_CHARACTERS', () => {
    const raw = buildRaw({
      characters: buildCharacters(MAX_IMPORT_CHARACTERS + 1),
      progress: {},
    })
    expect(parseBackupFile(raw)).toEqual({
      status: 'error',
      message: TOO_MANY_ELEMENTS_MESSAGE,
    })
  })

  it('accepts a store with exactly MAX_IMPORT_CHARACTERS characters', () => {
    const raw = buildRaw({
      characters: buildCharacters(MAX_IMPORT_CHARACTERS),
      progress: {},
    })
    expect(parseBackupFile(raw).status).toBe('ok')
  })

  it('rejects a character whose task progress exceeds MAX_IMPORT_TASKS_PER_CHARACTER', () => {
    const raw = buildRaw({
      characters: [DEFAULT_CHARACTER],
      progress: {
        [DEFAULT_CHARACTER.id]: buildTasks(MAX_IMPORT_TASKS_PER_CHARACTER + 1),
      },
    })
    expect(parseBackupFile(raw)).toEqual({
      status: 'error',
      message: TOO_MANY_ELEMENTS_MESSAGE,
    })
  })

  it('accepts a character with exactly MAX_IMPORT_TASKS_PER_CHARACTER task progress entries', () => {
    const raw = buildRaw({
      characters: [DEFAULT_CHARACTER],
      progress: {
        [DEFAULT_CHARACTER.id]: buildTasks(MAX_IMPORT_TASKS_PER_CHARACTER),
      },
    })
    expect(parseBackupFile(raw).status).toBe('ok')
  })

  it('rejects a taskOrder section exceeding MAX_IMPORT_TASK_ORDER_ENTRIES', () => {
    const raw = buildRaw({
      characters: [],
      progress: {},
      taskOrder: {
        daily: Array.from(
          { length: MAX_IMPORT_TASK_ORDER_ENTRIES + 1 },
          (_, index) => `task-${index}`,
        ),
        weekly: [],
      },
    })
    expect(parseBackupFile(raw)).toEqual({
      status: 'error',
      message: TOO_MANY_ELEMENTS_MESSAGE,
    })
  })

  it('rejects hiddenTaskIds exceeding MAX_IMPORT_HIDDEN_TASK_IDS', () => {
    const raw = buildRaw({
      characters: [],
      progress: {},
      hiddenTaskIds: Array.from(
        { length: MAX_IMPORT_HIDDEN_TASK_IDS + 1 },
        (_, index) => `task-${index}`,
      ),
    })
    expect(parseBackupFile(raw)).toEqual({
      status: 'error',
      message: TOO_MANY_ELEMENTS_MESSAGE,
    })
  })
})

describe('applyBackup', () => {
  it('writes the normalized store data to STORAGE_KEY', () => {
    const store = storeWithCharacter()
    applyBackup({ theme: null, storeData: store })
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(store))
  })

  it('writes the theme to THEME_STORAGE_KEY when present', () => {
    applyBackup({ theme: 'dark', storeData: storeWithCharacter() })
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('leaves the existing theme untouched when the backup theme is null', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    applyBackup({ theme: null, storeData: storeWithCharacter() })
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('saves the pre-import store to IMPORT_BACKUP_STORAGE_KEY before overwriting it', () => {
    const previousStore = storeWithCharacter({ characters: [] })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(previousStore))
    applyBackup({ theme: null, storeData: storeWithCharacter() })
    expect(localStorage.getItem(IMPORT_BACKUP_STORAGE_KEY)).toBe(
      JSON.stringify(previousStore),
    )
  })

  it('does not touch IMPORT_BACKUP_STORAGE_KEY when there is no pre-import store', () => {
    applyBackup({ theme: null, storeData: storeWithCharacter() })
    expect(localStorage.getItem(IMPORT_BACKUP_STORAGE_KEY)).toBeNull()
  })

  it('aborts without overwriting the store when the pre-import backup write fails', () => {
    const previousStore = storeWithCharacter({ characters: [] })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(previousStore))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key) => {
      if (key === IMPORT_BACKUP_STORAGE_KEY) {
        throw new Error('QuotaExceededError')
      }
    })

    const result = applyBackup({ theme: null, storeData: storeWithCharacter() })

    expect(result.status).toBe('error')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify(previousStore),
    )
  })

  it('aborts without overwriting the store when reading the pre-import store fails', () => {
    const previousStore = storeWithCharacter({ characters: [] })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(previousStore))
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) => {
      if (key === STORAGE_KEY) {
        throw new Error('SecurityError')
      }
      return null
    })

    const result = applyBackup({ theme: null, storeData: storeWithCharacter() })

    expect(result.status).toBe('error')
    expect(localStorage.getItem(IMPORT_BACKUP_STORAGE_KEY)).toBeNull()
  })

  it('returns an error result when the store write fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const result = applyBackup({ theme: null, storeData: storeWithCharacter() })
    expect(result.status).toBe('error')
  })

  it('treats a failing theme write as best-effort and still reports success', () => {
    const previousStore = storeWithCharacter({ characters: [] })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(previousStore))
    const originalSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      if (key === THEME_STORAGE_KEY) {
        throw new Error('QuotaExceededError')
      }
      originalSetItem.call(this, key, value)
    })
    const newStore = storeWithCharacter()

    const result = applyBackup({ theme: 'dark', storeData: newStore })

    expect(result.status).toBe('ok')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(newStore))
  })
})
