import upstreamTasksDocument from './upstreamTasks.json'

export type TaskCategory = 'daily' | 'weekly'

type TaskCategoryResolver = (taskId: string) => TaskCategory | null

const buildTaskCategoryMap = (): Map<string, TaskCategory> => {
  const map = new Map<string, TaskCategory>()
  for (const task of upstreamTasksDocument.daily) {
    map.set(task.id, 'daily')
  }
  for (const task of upstreamTasksDocument.weekly) {
    map.set(task.id, 'weekly')
  }
  return map
}

const taskCategoryMap = buildTaskCategoryMap()

export const getTaskCategory: TaskCategoryResolver = (taskId) =>
  taskCategoryMap.get(taskId) ?? null
