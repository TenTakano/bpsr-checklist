import {
  getCurrentDailyPeriodStart,
  getCurrentWeeklyPeriodStart,
} from '../data/resetConfig'
import { getTaskCategory, type TaskCategory } from '../data/taskLookup'
import { moveIdInOrder, resolveTaskOrderIds } from '../data/taskOrder'
import type { Action } from './actions'
import { MAX_CHARACTER_NAME_LENGTH, type Character } from './schema'
import type { Store } from './types'

const normalizeName = (name: string): string | null => {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_CHARACTER_NAME_LENGTH) {
    return null
  }
  return trimmed
}

const DUPLICATE_NAME_SUFFIX = ' のコピー'

const buildDuplicateName = (sourceName: string): string => {
  const maxSourceLength =
    MAX_CHARACTER_NAME_LENGTH - DUPLICATE_NAME_SUFFIX.length
  const truncatedSource = sourceName.slice(0, maxSourceLength)
  return `${truncatedSource}${DUPLICATE_NAME_SUFFIX}`
}

const removeProgressEntry = (
  progress: Store['progress'],
  characterId: string,
): Store['progress'] => {
  const next = { ...progress }
  delete next[characterId]
  return next
}

const hasCharacter = (store: Store, id: string): boolean =>
  store.characters.some((character) => character.id === id)

const shouldResetPeriod = (
  storedPeriodStart: string | undefined,
  currentPeriodStart: string,
): boolean => {
  if (storedPeriodStart === undefined) {
    return false
  }
  const storedTime = Date.parse(storedPeriodStart)
  const currentTime = Date.parse(currentPeriodStart)
  return !Number.isNaN(storedTime) && storedTime < currentTime
}

interface RemoveCategoriesResult {
  progress: Store['progress']
  changed: boolean
}

const removeCategoriesFromProgress = (
  progress: Store['progress'],
  categoriesToReset: ReadonlySet<TaskCategory>,
): RemoveCategoriesResult => {
  const nextProgress: Store['progress'] = {}
  let changed = false

  for (const [characterId, taskProgress] of Object.entries(progress)) {
    const remaining: Record<string, number> = {}
    let characterChanged = false
    for (const [taskId, value] of Object.entries(taskProgress)) {
      const category = getTaskCategory(taskId)
      if (category !== null && categoriesToReset.has(category)) {
        characterChanged = true
      } else {
        remaining[taskId] = value
      }
    }
    if (characterChanged) {
      nextProgress[characterId] = remaining
      changed = true
    } else {
      nextProgress[characterId] = taskProgress
    }
  }

  return { progress: nextProgress, changed }
}

export const evaluateResetState = (store: Store, now: Date): Store => {
  const currentDailyPeriodStart = getCurrentDailyPeriodStart(now)
  const currentWeeklyPeriodStart = getCurrentWeeklyPeriodStart(now)

  const periodUnchanged =
    store.resetState?.dailyPeriodStart === currentDailyPeriodStart &&
    store.resetState?.weeklyPeriodStart === currentWeeklyPeriodStart

  if (periodUnchanged) {
    return store
  }

  const categoriesToReset = new Set<TaskCategory>()
  if (
    shouldResetPeriod(
      store.resetState?.dailyPeriodStart,
      currentDailyPeriodStart,
    )
  ) {
    categoriesToReset.add('daily')
  }
  if (
    shouldResetPeriod(
      store.resetState?.weeklyPeriodStart,
      currentWeeklyPeriodStart,
    )
  ) {
    categoriesToReset.add('weekly')
  }

  let progress = store.progress
  if (categoriesToReset.size > 0) {
    const result = removeCategoriesFromProgress(
      store.progress,
      categoriesToReset,
    )
    if (result.changed) {
      progress = result.progress
    }
  }

  return {
    ...store,
    resetState: {
      dailyPeriodStart: currentDailyPeriodStart,
      weeklyPeriodStart: currentWeeklyPeriodStart,
    },
    progress,
  }
}

export const reducer = (store: Store, action: Action): Store => {
  switch (action.type) {
    case 'addCharacter': {
      const name = normalizeName(action.name)
      if (name === null) {
        return store
      }
      const character: Character = {
        id: crypto.randomUUID(),
        name,
        createdAt: new Date().toISOString(),
      }
      return {
        ...store,
        characters: [...store.characters, character],
      }
    }

    case 'renameCharacter': {
      const name = normalizeName(action.name)
      if (name === null) {
        return store
      }
      if (!hasCharacter(store, action.id)) {
        return store
      }
      return {
        ...store,
        characters: store.characters.map((character) =>
          character.id === action.id ? { ...character, name } : character,
        ),
      }
    }

    case 'duplicateCharacter': {
      const source = store.characters.find(
        (character) => character.id === action.id,
      )
      if (source === undefined) {
        return store
      }
      const character: Character = {
        id: crypto.randomUUID(),
        name: buildDuplicateName(source.name),
        createdAt: new Date().toISOString(),
      }
      const sourceProgress = store.progress[source.id] ?? {}
      return {
        ...store,
        characters: [...store.characters, character],
        progress: {
          ...store.progress,
          [character.id]: { ...sourceProgress },
        },
      }
    }

    case 'removeCharacter': {
      if (!hasCharacter(store, action.id)) {
        return store
      }
      return {
        ...store,
        characters: store.characters.filter(
          (character) => character.id !== action.id,
        ),
        progress: removeProgressEntry(store.progress, action.id),
      }
    }

    case 'setProgress': {
      if (!Number.isInteger(action.value) || action.value < 0) {
        return store
      }
      if (!hasCharacter(store, action.characterId)) {
        return store
      }
      const resetApplied = evaluateResetState(store, new Date())
      const characterProgress = resetApplied.progress[action.characterId] ?? {}
      return {
        ...resetApplied,
        progress: {
          ...resetApplied.progress,
          [action.characterId]: {
            ...characterProgress,
            [action.taskId]: action.value,
          },
        },
      }
    }

    case 'evaluateReset': {
      return evaluateResetState(store, action.now)
    }

    case 'moveTask': {
      const currentOrder = resolveTaskOrderIds(
        action.section,
        store.taskOrder?.[action.section],
      )
      const nextOrder = moveIdInOrder(
        currentOrder,
        action.taskId,
        action.toIndex,
      )
      if (nextOrder === currentOrder) {
        return store
      }
      const dailyOrder =
        action.section === 'daily'
          ? nextOrder
          : resolveTaskOrderIds('daily', store.taskOrder?.daily)
      const weeklyOrder =
        action.section === 'weekly'
          ? nextOrder
          : resolveTaskOrderIds('weekly', store.taskOrder?.weekly)
      return {
        ...store,
        taskOrder: { daily: dailyOrder, weekly: weeklyOrder },
      }
    }
  }
}
