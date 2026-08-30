import { z } from 'zod'
import { PROJECT_TASKS_BY_RESET_CYCLE } from './projectTasksResolver'
import { RESET_CYCLES } from './resetCycle'

export const TaskCategorySchema = z.enum([
  ...RESET_CYCLES,
  'milestone',
] as const)

export type TaskCategory = z.infer<typeof TaskCategorySchema>

export const TASK_CATEGORIES: readonly TaskCategory[] = [
  ...RESET_CYCLES,
  'milestone',
]

type TaskCategoryResolver = (taskId: string) => TaskCategory | null

const buildTaskCategoryMap = (): Map<string, TaskCategory> => {
  const map = new Map<string, TaskCategory>()
  for (const cycle of RESET_CYCLES) {
    for (const task of PROJECT_TASKS_BY_RESET_CYCLE[cycle]) {
      map.set(task.id, cycle)
    }
  }
  return map
}

const taskCategoryMap = buildTaskCategoryMap()

export const getTaskCategory: TaskCategoryResolver = (taskId) =>
  taskCategoryMap.get(taskId) ?? null
