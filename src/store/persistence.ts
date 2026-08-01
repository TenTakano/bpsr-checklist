import upstreamTasksDocument from '../data/upstreamTasks.json'
import {
  CharacterSchema,
  ProgressValueSchema,
  ResetStateSchema,
  StoreSchema,
  TaskOrderSchema,
  type Character,
} from './schema'
import type { Store } from './types'

export const STORAGE_KEY = 'bpsr-checklist:store'
export const BACKUP_STORAGE_KEY = 'bpsr-checklist:store.backup'
export const RESET_BACKUP_STORAGE_KEY = 'bpsr-checklist:store.reset-backup'

export const createEmptyStore = (): Store => ({
  schemaVersion: 1,
  taskDataVersion: upstreamTasksDocument.upstreamCommit,
  characters: [],
  progress: {},
})

export type LoadResult =
  | { status: 'ok'; store: Store }
  | { status: 'recovered'; store: Store; corruptedRaw: string }
  | { status: 'readonly' }

export type SaveResult = { status: 'ok' } | { status: 'error'; error: unknown }

const recoverFromCorruption = (raw: string): LoadResult => ({
  status: 'recovered',
  store: createEmptyStore(),
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

export const loadStore = (): LoadResult => {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { status: 'readonly' }
  }
  if (raw === null) {
    return { status: 'ok', store: createEmptyStore() }
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

  const characters = rescueCharacters(topLevel.data.characters)
  const progress = rescueProgress(topLevel.data.progress, characters)
  const resetState = rescueResetState(topLevel.data.resetState)
  const taskOrder = rescueTaskOrder(topLevel.data.taskOrder)

  return {
    status: 'ok',
    store: {
      ...extraTopLevelFields(topLevel.data),
      schemaVersion: topLevel.data.schemaVersion,
      taskDataVersion: topLevel.data.taskDataVersion,
      characters,
      progress,
      resetState,
      taskOrder,
    },
  }
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
