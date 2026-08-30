import type { z } from 'zod'
import { CustomTaskSchema } from '../data/customTaskSchema'
import upstreamTasksDocument from '../data/upstreamTasks.json'
import {
  CharacterSchema,
  DetailedCountTaskIdsSchema,
  HiddenTaskIdsSchema,
  ProgressValueSchema,
  ResetStateSchema,
  StoreSchema,
  TaskOrderSchema,
  type Character,
  type CustomTask,
} from './schema'
import type { Store } from './types'

export const STORAGE_KEY = 'bpsr-checklist:store'
export const BACKUP_STORAGE_KEY = 'bpsr-checklist:store.backup'
export const RESET_BACKUP_STORAGE_KEY = 'bpsr-checklist:store.reset-backup'
export const IMPORT_BACKUP_STORAGE_KEY = 'bpsr-checklist:store.import-backup'

const DEFAULT_CHARACTER_NAME = 'NoName'

const createDefaultCharacter = (): Character => ({
  id: crypto.randomUUID(),
  name: DEFAULT_CHARACTER_NAME,
  createdAt: new Date().toISOString(),
})

export const createInitialStore = (): Store => ({
  schemaVersion: 1,
  taskDataVersion: upstreamTasksDocument.upstreamCommit,
  characters: [createDefaultCharacter()],
  progress: {},
})

export type LoadResult =
  | { status: 'ok'; store: Store }
  | { status: 'recovered'; store: Store; corruptedRaw: string }
  | { status: 'readonly' }

export type SaveResult = { status: 'ok' } | { status: 'error'; error: unknown }

const recoverFromCorruption = (raw: string): LoadResult => ({
  status: 'recovered',
  store: createInitialStore(),
  corruptedRaw: raw,
})

export const backupCorruptedStore = (raw: string): SaveResult => {
  try {
    localStorage.setItem(BACKUP_STORAGE_KEY, raw)
    return { status: 'ok' }
  } catch (error) {
    return { status: 'error', error }
  }
}

export const backupPreImportStore = (raw: string): SaveResult => {
  try {
    localStorage.setItem(IMPORT_BACKUP_STORAGE_KEY, raw)
    return { status: 'ok' }
  } catch (error) {
    return { status: 'error', error }
  }
}

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const rescueCharacters = (rawCharacters: unknown[]): Character[] => {
  const seenIds = new Set<string>()
  const characters: Character[] = []
  for (const candidate of rawCharacters) {
    const result = CharacterSchema.safeParse(candidate)
    if (
      !result.success ||
      seenIds.has(result.data.id) ||
      UNSAFE_OBJECT_KEYS.has(result.data.id)
    ) {
      continue
    }
    seenIds.add(result.data.id)
    characters.push(result.data)
  }
  return characters
}

const rescueProgress = (
  rawProgress: Record<string, Record<string, unknown>>,
  characters: Character[],
): Store['progress'] => {
  const characterIds = new Set(characters.map((character) => character.id))
  const progress: Store['progress'] = {}
  for (const [characterId, taskProgress] of Object.entries(rawProgress)) {
    if (!characterIds.has(characterId) || UNSAFE_OBJECT_KEYS.has(characterId)) {
      continue
    }
    const tasks: Record<string, number> = {}
    for (const [taskId, value] of Object.entries(taskProgress)) {
      if (UNSAFE_OBJECT_KEYS.has(taskId)) {
        continue
      }
      const result = ProgressValueSchema.safeParse(value)
      if (result.success) {
        tasks[taskId] = result.data
      }
    }
    progress[characterId] = tasks
  }
  return progress
}

const extraTopLevelFields = (
  data: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(data).filter(
      ([key]) =>
        key !== 'characters' &&
        key !== 'progress' &&
        key !== 'resetState' &&
        key !== 'taskOrder' &&
        key !== 'hiddenTaskIds' &&
        key !== 'detailedCountTaskIds' &&
        key !== 'customTasks' &&
        !UNSAFE_OBJECT_KEYS.has(key),
    ),
  )

// An invalid resetState degrades to "absent" (undefined) rather than
// rejecting the whole store, so the reducer's evaluateResetState treats it
// as needing initialization only, never a destructive reset.
const rescueResetState = (raw: unknown): Store['resetState'] => {
  const result = ResetStateSchema.safeParse(raw)
  return result.success ? result.data : undefined
}

// An invalid taskOrder degrades to "absent" (undefined) rather than
// rejecting the whole store, so the MatrixView falls back to definition
// order instead of losing the rest of the store.
const rescueTaskOrder = (raw: unknown): Store['taskOrder'] => {
  const result = TaskOrderSchema.safeParse(raw)
  return result.success ? result.data : undefined
}

// An invalid hiddenTaskIds degrades to "absent" (undefined) rather than
// rejecting the whole store, so the MatrixView/TaskVisibility fall back to
// showing every task instead of losing the rest of the store.
const rescueHiddenTaskIds = (raw: unknown): Store['hiddenTaskIds'] => {
  const result = HiddenTaskIdsSchema.safeParse(raw)
  return result.success ? result.data : undefined
}

// An invalid detailedCountTaskIds degrades to "absent" (undefined) rather
// than rejecting the whole store, so the MatrixView/TaskVisibility fall back
// to the default checkbox display instead of losing the rest of the store.
const rescueDetailedCountTaskIds = (
  raw: unknown,
): Store['detailedCountTaskIds'] => {
  const result = DetailedCountTaskIdsSchema.safeParse(raw)
  return result.success ? result.data : undefined
}

// customTasks is a user-generated array (like characters), so a single
// invalid element degrades to skipping just that element rather than the
// all-or-nothing degradation used for resetState/taskOrder/hiddenTaskIds/
// detailedCountTaskIds. This prevents one corrupt entry from wiping every
// custom task on the next mount-time autosave.
const rescueCustomTasks = (raw: unknown): Store['customTasks'] => {
  if (!Array.isArray(raw)) {
    return undefined
  }
  const seenIds = new Set<string>()
  const customTasks: CustomTask[] = []
  for (const candidate of raw) {
    const result = CustomTaskSchema.safeParse(candidate)
    if (!result.success || seenIds.has(result.data.id)) {
      continue
    }
    seenIds.add(result.data.id)
    customTasks.push(result.data)
  }
  return customTasks
}

export const normalizeStoreData = (
  data: z.infer<typeof StoreSchema>,
): Store => {
  const characters = rescueCharacters(data.characters)
  const progress = rescueProgress(data.progress, characters)
  const resetState = rescueResetState(data.resetState)
  const taskOrder = rescueTaskOrder(data.taskOrder)
  const hiddenTaskIds = rescueHiddenTaskIds(data.hiddenTaskIds)
  const detailedCountTaskIds = rescueDetailedCountTaskIds(
    data.detailedCountTaskIds,
  )
  const customTasks = rescueCustomTasks(data.customTasks)

  return {
    ...extraTopLevelFields(data),
    schemaVersion: data.schemaVersion,
    taskDataVersion: data.taskDataVersion,
    characters,
    progress,
    resetState,
    taskOrder,
    hiddenTaskIds,
    detailedCountTaskIds,
    customTasks,
  }
}

export const loadStore = (): LoadResult => {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { status: 'readonly' }
  }
  if (raw === null) {
    return { status: 'ok', store: createInitialStore() }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return recoverFromCorruption(raw)
  }

  const topLevel = StoreSchema.safeParse(parsed)
  if (!topLevel.success) {
    return recoverFromCorruption(raw)
  }

  return { status: 'ok', store: normalizeStoreData(topLevel.data) }
}

export const saveStore = (store: Store): SaveResult => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    return { status: 'ok' }
  } catch (error) {
    return { status: 'error', error }
  }
}

export const backupResetSnapshot = (
  removedProgress: Store['progress'],
): SaveResult => {
  try {
    localStorage.setItem(
      RESET_BACKUP_STORAGE_KEY,
      JSON.stringify({
        backedUpAt: new Date().toISOString(),
        progress: removedProgress,
      }),
    )
    return { status: 'ok' }
  } catch (error) {
    return { status: 'error', error }
  }
}

export const diffRemovedProgress = (
  previousProgress: Store['progress'],
  nextProgress: Store['progress'],
): Store['progress'] => {
  const removed: Store['progress'] = {}
  for (const [characterId, previousTasks] of Object.entries(previousProgress)) {
    if (UNSAFE_OBJECT_KEYS.has(characterId)) {
      continue
    }
    const nextTasks = nextProgress[characterId] ?? {}
    const removedTasks: Record<string, number> = {}
    for (const [taskId, value] of Object.entries(previousTasks)) {
      if (UNSAFE_OBJECT_KEYS.has(taskId)) {
        continue
      }
      if (!Object.hasOwn(nextTasks, taskId)) {
        removedTasks[taskId] = value
      }
    }
    if (Object.keys(removedTasks).length > 0) {
      removed[characterId] = removedTasks
    }
  }
  return removed
}
