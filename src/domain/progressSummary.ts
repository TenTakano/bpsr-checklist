import type { Character } from '../store/schema'
import type { Store } from '../store/types'
import { isTaskComplete, readProgressValue } from './taskProgress'

export interface ProgressSummaryTask {
  id: string
  maxProgress: number
}

export interface CharacterProgressCount {
  characterId: string
  completed: number
  total: number
}

export interface CategoryProgressSummary {
  completed: number
  total: number
  percent: number
  byCharacter: CharacterProgressCount[]
}

const calculatePercent = (completed: number, total: number): number =>
  total === 0 ? 0 : Math.round((completed / total) * 100)

export const summarizeCategoryProgress = (
  tasks: ProgressSummaryTask[],
  characters: Character[],
  progress: Store['progress'],
  hiddenTaskIds: string[] | undefined,
): CategoryProgressSummary => {
  const hiddenTaskIdSet = new Set(hiddenTaskIds ?? [])
  const visibleTasks = tasks.filter((task) => !hiddenTaskIdSet.has(task.id))

  const byCharacter: CharacterProgressCount[] = characters.map((character) => ({
    characterId: character.id,
    completed: visibleTasks.filter((task) =>
      isTaskComplete(
        readProgressValue(progress, character.id, task.id),
        task.maxProgress,
      ),
    ).length,
    total: visibleTasks.length,
  }))

  const completed = byCharacter.reduce((sum, entry) => sum + entry.completed, 0)
  const total = visibleTasks.length * characters.length

  return {
    completed,
    total,
    percent: calculatePercent(completed, total),
    byCharacter,
  }
}
