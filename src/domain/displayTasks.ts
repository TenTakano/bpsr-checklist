import type { CustomTask } from '../data/customTaskSchema'
import { getTaskLabel } from '../data/taskLabel'
import type { TaskCategory } from '../data/taskLookup'
import { TASKS_BY_CATEGORY } from '../data/taskOrder'

export interface DisplayTask {
  id: string
  label: string
  color: string
  maxProgress: number
}

export function getDisplayTasksByCategory(
  category: TaskCategory,
  customTasks: CustomTask[] | undefined,
): DisplayTask[] {
  const staticTasks: DisplayTask[] = TASKS_BY_CATEGORY[category].map(
    (task) => ({
      id: task.id,
      label: getTaskLabel(task),
      color: task.color,
      maxProgress: task.maxProgress,
    }),
  )
  const categoryCustomTasks: DisplayTask[] = (customTasks ?? [])
    .filter((task) => task.category === category)
    .map((task) => ({
      id: task.id,
      label: task.name,
      color: task.color,
      maxProgress: task.maxProgress,
    }))
  return [...staticTasks, ...categoryCustomTasks]
}
