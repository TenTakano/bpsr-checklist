import type { TaskColorToken } from '../data/taskColors'
import type { TaskCategory } from '../data/taskLookup'

export type Action =
  | { type: 'addCharacter'; name: string }
  | { type: 'renameCharacter'; id: string; name: string }
  | { type: 'duplicateCharacter'; id: string }
  | { type: 'removeCharacter'; id: string }
  | { type: 'setProgress'; characterId: string; taskId: string; value: number }
  | { type: 'evaluateReset'; now: Date }
  | {
      type: 'moveTask'
      section: TaskCategory
      taskId: string
      toIndex: number
    }
  | { type: 'setTaskHidden'; taskId: string; hidden: boolean }
  | { type: 'setTaskDetailedCount'; taskId: string; detailed: boolean }
  | {
      type: 'addCustomTask'
      name: string
      color: TaskColorToken
      maxProgress: number
      category: TaskCategory
    }
  | {
      type: 'updateCustomTask'
      id: string
      name: string
      color: TaskColorToken
      maxProgress: number
      category: TaskCategory
    }
  | { type: 'removeCustomTask'; id: string }

export const addCharacter = (name: string): Action => ({
  type: 'addCharacter',
  name,
})

export const renameCharacter = (id: string, name: string): Action => ({
  type: 'renameCharacter',
  id,
  name,
})

export const duplicateCharacter = (id: string): Action => ({
  type: 'duplicateCharacter',
  id,
})

export const removeCharacter = (id: string): Action => ({
  type: 'removeCharacter',
  id,
})

export const setProgress = (
  characterId: string,
  taskId: string,
  value: number,
): Action => ({
  type: 'setProgress',
  characterId,
  taskId,
  value,
})

export const evaluateReset = (now: Date): Action => ({
  type: 'evaluateReset',
  now,
})

export const moveTask = (
  section: TaskCategory,
  taskId: string,
  toIndex: number,
): Action => ({
  type: 'moveTask',
  section,
  taskId,
  toIndex,
})

export const setTaskHidden = (taskId: string, hidden: boolean): Action => ({
  type: 'setTaskHidden',
  taskId,
  hidden,
})

export const setTaskDetailedCount = (
  taskId: string,
  detailed: boolean,
): Action => ({
  type: 'setTaskDetailedCount',
  taskId,
  detailed,
})

export const addCustomTask = (
  name: string,
  color: TaskColorToken,
  maxProgress: number,
  category: TaskCategory,
): Action => ({
  type: 'addCustomTask',
  name,
  color,
  maxProgress,
  category,
})

export const updateCustomTask = (
  id: string,
  name: string,
  color: TaskColorToken,
  maxProgress: number,
  category: TaskCategory,
): Action => ({
  type: 'updateCustomTask',
  id,
  name,
  color,
  maxProgress,
  category,
})

export const removeCustomTask = (id: string): Action => ({
  type: 'removeCustomTask',
  id,
})
