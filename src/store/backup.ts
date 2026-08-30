import { TASK_CATEGORIES } from '../data/taskLookup'
import {
  STORAGE_KEY,
  backupPreImportStore,
  normalizeStoreData,
  saveStore,
  type SaveResult,
} from './persistence'
import { StoreSchema } from './schema'
import { isTheme, THEME_STORAGE_KEY, type Theme } from './theme'
import type { Store } from './types'

export const EXPORT_VERSION = 1
export const SUPPORTED_STORE_SCHEMA_VERSION = 1

export type BackupTheme = Theme | null

export interface BackupEnvelope {
  version: typeof EXPORT_VERSION
  exportedAt: string
  theme: BackupTheme
  store: Store
}

export const buildBackupEnvelope = (
  store: Store,
  theme: BackupTheme,
  now: Date,
): BackupEnvelope => ({
  version: EXPORT_VERSION,
  exportedAt: now.toISOString(),
  theme,
  store,
})

export const serializeBackupEnvelope = (envelope: BackupEnvelope): string =>
  JSON.stringify(envelope, null, 2)

const padTwoDigits = (value: number): string => String(value).padStart(2, '0')

export const backupFileName = (now: Date): string =>
  `bpsr-checklist-backup-${now.getFullYear()}-${padTwoDigits(now.getMonth() + 1)}-${padTwoDigits(now.getDate())}.json`

export const INVALID_JSON_MESSAGE =
  'ファイルを読み取れませんでした。JSON形式が正しくありません。'
export const UNSUPPORTED_VERSION_MESSAGE =
  '対応していないバックアップ形式です。'
export const INVALID_STORE_MESSAGE = 'ファイル形式が正しくありません。'
export const UNSUPPORTED_SCHEMA_VERSION_MESSAGE = '未対応のバージョンです。'
export const TOO_MANY_ELEMENTS_MESSAGE =
  'ファイル内のデータ件数が上限を超えています。'

export const MAX_IMPORT_CHARACTERS = 200
export const MAX_IMPORT_TASKS_PER_CHARACTER = 500
export const MAX_IMPORT_TASK_ORDER_ENTRIES = 500
export const MAX_IMPORT_HIDDEN_TASK_IDS = 500
export const MAX_IMPORT_CUSTOM_TASKS = 200

const exceedsImportLimits = (storeData: Store): boolean => {
  if (storeData.characters.length > MAX_IMPORT_CHARACTERS) {
    return true
  }
  const taskProgressEntries = Object.values(storeData.progress)
  if (taskProgressEntries.length > MAX_IMPORT_CHARACTERS) {
    return true
  }
  if (
    taskProgressEntries.some(
      (taskProgress) =>
        Object.keys(taskProgress).length > MAX_IMPORT_TASKS_PER_CHARACTER,
    )
  ) {
    return true
  }
  if (
    TASK_CATEGORIES.some(
      (category) =>
        (storeData.taskOrder?.[category]?.length ?? 0) >
        MAX_IMPORT_TASK_ORDER_ENTRIES,
    )
  ) {
    return true
  }
  if ((storeData.hiddenTaskIds?.length ?? 0) > MAX_IMPORT_HIDDEN_TASK_IDS) {
    return true
  }
  if ((storeData.customTasks?.length ?? 0) > MAX_IMPORT_CUSTOM_TASKS) {
    return true
  }
  return false
}

export interface ParsedBackup {
  theme: BackupTheme
  storeData: Store
}

export type ParseBackupFileResult =
  { status: 'ok'; backup: ParsedBackup } | { status: 'error'; message: string }

export const parseBackupFile = (raw: string): ParseBackupFileResult => {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { status: 'error', message: INVALID_JSON_MESSAGE }
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { status: 'error', message: INVALID_STORE_MESSAGE }
  }

  const envelope = parsed as Record<string, unknown>

  if (envelope.version !== EXPORT_VERSION) {
    return { status: 'error', message: UNSUPPORTED_VERSION_MESSAGE }
  }

  const topLevel = StoreSchema.safeParse(envelope.store)
  if (!topLevel.success) {
    return { status: 'error', message: INVALID_STORE_MESSAGE }
  }

  if (topLevel.data.schemaVersion > SUPPORTED_STORE_SCHEMA_VERSION) {
    return { status: 'error', message: UNSUPPORTED_SCHEMA_VERSION_MESSAGE }
  }

  const themeCandidate =
    typeof envelope.theme === 'string' ? envelope.theme : null
  const theme = isTheme(themeCandidate) ? themeCandidate : null

  const storeData = normalizeStoreData(topLevel.data)
  if (exceedsImportLimits(storeData)) {
    return { status: 'error', message: TOO_MANY_ELEMENTS_MESSAGE }
  }

  return {
    status: 'ok',
    backup: { theme, storeData },
  }
}

type ReadRawStoreResult =
  { status: 'ok'; raw: string | null } | { status: 'error'; error: unknown }

const readRawStoreBeforeOverwrite = (): ReadRawStoreResult => {
  try {
    return { status: 'ok', raw: localStorage.getItem(STORAGE_KEY) }
  } catch (error) {
    return { status: 'error', error }
  }
}

const persistThemeBestEffort = (theme: Theme): void => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    return
  }
}

export const applyBackup = (backup: ParsedBackup): SaveResult => {
  const readResult = readRawStoreBeforeOverwrite()
  if (readResult.status === 'error') {
    return readResult
  }
  const previousRaw = readResult.raw

  if (previousRaw !== null) {
    const preImportBackupResult = backupPreImportStore(previousRaw)
    if (preImportBackupResult.status === 'error') {
      return preImportBackupResult
    }
  }

  const saveResult = saveStore(backup.storeData)
  if (saveResult.status === 'error') {
    return saveResult
  }

  if (backup.theme !== null) {
    persistThemeBestEffort(backup.theme)
  }

  return { status: 'ok' }
}
