import {
  MAX_CUSTOM_TASK_MAX_PROGRESS,
  MAX_CUSTOM_TASK_NAME_LENGTH,
  MAX_CUSTOM_TASKS,
  MIN_CUSTOM_TASK_MAX_PROGRESS,
} from '../data/customTaskSchema'
import { PERIOD_START_RESOLVERS } from '../data/resetConfig'
import { RESET_CYCLES, type ResetCycle } from '../data/resetCycle'
import {
  getTaskCategory,
  TASK_CATEGORIES,
  type TaskCategory,
} from '../data/taskLookup'
import { moveIdInOrder, resolveTaskOrderIds } from '../data/taskOrder'
import type { Action } from './actions'
import {
  MAX_CHARACTER_NAME_LENGTH,
  type Character,
  type CustomTask,
  type ResetState,
} from './schema'
import type { Store } from './types'

const normalizeTrimmedText = (
  value: string,
  maxLength: number,
): string | null => {
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return null
  }
  return trimmed
}

const normalizeName = (name: string): string | null =>
  normalizeTrimmedText(name, MAX_CHARACTER_NAME_LENGTH)

const isValidMaxProgress = (value: number): boolean =>
  Number.isInteger(value) &&
  value >= MIN_CUSTOM_TASK_MAX_PROGRESS &&
  value <= MAX_CUSTOM_TASK_MAX_PROGRESS

const createCustomTaskId = (): string =>
  `custom_${crypto.randomUUID().replaceAll('-', '_')}`

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

const removeTaskFromProgress = (
  progress: Store['progress'],
  taskId: string,
): Store['progress'] => {
  const next: Store['progress'] = {}
  for (const [characterId, taskProgress] of Object.entries(progress)) {
    if (!(taskId in taskProgress)) {
      next[characterId] = taskProgress
      continue
    }
    next[characterId] = Object.fromEntries(
      Object.entries(taskProgress).filter(([id]) => id !== taskId),
    )
  }
  return next
}

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

const buildCustomTaskCategoryMap = (
  customTasks: Store['customTasks'],
): Map<string, TaskCategory> =>
  new Map((customTasks ?? []).map((task) => [task.id, task.category]))

const removeCategoriesFromProgress = (
  progress: Store['progress'],
  categoriesToReset: ReadonlySet<ResetCycle>,
  customTasks: Store['customTasks'],
): RemoveCategoriesResult => {
  const customTaskCategoryMap = buildCustomTaskCategoryMap(customTasks)
  const nextProgress: Store['progress'] = {}
  let changed = false

  for (const [characterId, taskProgress] of Object.entries(progress)) {
    const remaining: Record<string, number> = {}
    let characterChanged = false
    for (const [taskId, value] of Object.entries(taskProgress)) {
      const category =
        customTaskCategoryMap.get(taskId) ?? getTaskCategory(taskId)
      if (
        category !== null &&
        category !== 'milestone' &&
        categoriesToReset.has(category)
      ) {
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
  const currentPeriodStarts = Object.fromEntries(
    RESET_CYCLES.map((cycle) => [cycle, PERIOD_START_RESOLVERS[cycle](now)]),
  ) as ResetState

  const periodUnchanged = RESET_CYCLES.every(
    (cycle) => store.resetState?.[cycle] === currentPeriodStarts[cycle],
  )

  if (periodUnchanged) {
    return store
  }

  const categoriesToReset = new Set<ResetCycle>()
  for (const cycle of RESET_CYCLES) {
    if (
      shouldResetPeriod(store.resetState?.[cycle], currentPeriodStarts[cycle])
    ) {
      categoriesToReset.add(cycle)
    }
  }

  let progress = store.progress
  if (categoriesToReset.size > 0) {
    const result = removeCategoriesFromProgress(
      store.progress,
      categoriesToReset,
      store.customTasks,
    )
    if (result.changed) {
      progress = result.progress
    }
  }

  return {
    ...store,
    resetState: currentPeriodStarts,
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
        store.customTasks,
      )
      const nextOrder = moveIdInOrder(
        currentOrder,
        action.taskId,
        action.toIndex,
      )
      if (nextOrder === currentOrder) {
        return store
      }
      const taskOrder = Object.fromEntries(
        TASK_CATEGORIES.map((category) => [
          category,
          category === action.section
            ? nextOrder
            : resolveTaskOrderIds(
                category,
                store.taskOrder?.[category],
                store.customTasks,
              ),
        ]),
      ) as Record<TaskCategory, string[]>
      return {
        ...store,
        taskOrder,
      }
    }

    case 'setTaskHidden': {
      const currentHiddenTaskIds = store.hiddenTaskIds ?? []
      const isHidden = currentHiddenTaskIds.includes(action.taskId)
      if (action.hidden === isHidden) {
        return store
      }
      const hiddenTaskIds = action.hidden
        ? [...currentHiddenTaskIds, action.taskId]
        : currentHiddenTaskIds.filter((id) => id !== action.taskId)
      return { ...store, hiddenTaskIds }
    }

    case 'setTaskDetailedCount': {
      const currentDetailedCountTaskIds = store.detailedCountTaskIds ?? []
      const isDetailed = currentDetailedCountTaskIds.includes(action.taskId)
      if (action.detailed === isDetailed) {
        return store
      }
      const detailedCountTaskIds = action.detailed
        ? [...currentDetailedCountTaskIds, action.taskId]
        : currentDetailedCountTaskIds.filter((id) => id !== action.taskId)
      return { ...store, detailedCountTaskIds }
    }

    case 'addCustomTask': {
      const name = normalizeTrimmedText(
        action.name,
        MAX_CUSTOM_TASK_NAME_LENGTH,
      )
      if (
        name === null ||
        !isValidMaxProgress(action.maxProgress) ||
        (store.customTasks?.length ?? 0) >= MAX_CUSTOM_TASKS
      ) {
        return store
      }
      const customTask: CustomTask = {
        id: createCustomTaskId(),
        name,
        color: action.color,
        maxProgress: action.maxProgress,
        category: action.category,
      }
      return {
        ...store,
        customTasks: [...(store.customTasks ?? []), customTask],
      }
    }

    case 'updateCustomTask': {
      const name = normalizeTrimmedText(
        action.name,
        MAX_CUSTOM_TASK_NAME_LENGTH,
      )
      if (name === null || !isValidMaxProgress(action.maxProgress)) {
        return store
      }
      const currentCustomTasks = store.customTasks ?? []
      if (!currentCustomTasks.some((task) => task.id === action.id)) {
        return store
      }
      return {
        ...store,
        customTasks: currentCustomTasks.map((task) =>
          task.id === action.id
            ? {
                ...task,
                name,
                color: action.color,
                maxProgress: action.maxProgress,
                category: action.category,
              }
            : task,
        ),
      }
    }

    case 'removeCustomTask': {
      const currentCustomTasks = store.customTasks ?? []
      if (!currentCustomTasks.some((task) => task.id === action.id)) {
        return store
      }
      return {
        ...store,
        customTasks: currentCustomTasks.filter((task) => task.id !== action.id),
        progress: removeTaskFromProgress(store.progress, action.id),
      }
    }
  }
}
