import { DAILY_TASKS, WEEKLY_TASKS } from './projectTasksResolver'

export type TaskCategory = 'daily' | 'weekly'

type TaskCategoryResolver = (taskId: string) => TaskCategory | null

const buildTaskCategoryMap = (): Map<string, TaskCategory> => {
  const map = new Map<string, TaskCategory>()
  for (const task of DAILY_TASKS) {
    map.set(task.id, 'daily')
  }
  for (const task of WEEKLY_TASKS) {
    map.set(task.id, 'weekly')
  }
  return map
}

const taskCategoryMap = buildTaskCategoryMap()

export const getTaskCategory: TaskCategoryResolver = (taskId) =>
  taskCategoryMap.get(taskId) ?? null
