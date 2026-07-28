import upstreamTasksDocument from '../data/upstreamTasks.json'
import {
  CharacterSchema,
  ProgressValueSchema,
  StoreSchema,
  type Character,
} from './schema'
import type { Store } from './types'

export const STORAGE_KEY = 'bpsr-checklist:store'
export const BACKUP_STORAGE_KEY = 'bpsr-checklist:store.backup'

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
        !UNSAFE_OBJECT_KEYS.has(key),
    ),
  )

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

  return {
    status: 'ok',
    store: {
      ...extraTopLevelFields(topLevel.data),
      schemaVersion: topLevel.data.schemaVersion,
      taskDataVersion: topLevel.data.taskDataVersion,
      characters,
      progress,
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
