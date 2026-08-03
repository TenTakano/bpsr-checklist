import type { Store } from '../store/types'

export const isTaskComplete = (value: number, maxProgress: number): boolean =>
  value >= maxProgress

export const readProgressValue = (
  progress: Store['progress'],
  characterId: string,
  taskId: string,
): number => {
  if (!Object.hasOwn(progress, characterId)) {
    return 0
  }
  const characterProgress = progress[characterId]
  if (!Object.hasOwn(characterProgress, taskId)) {
    return 0
  }
  return characterProgress[taskId] ?? 0
}
