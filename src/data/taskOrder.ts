import { PROJECT_TASKS_BY_RESET_CYCLE } from './projectTasksResolver'
import type { ProjectTask } from './projectTaskSchema'
import type { TaskCategory } from './taskLookup'

export function resolveTaskOrder(
  tasks: ProjectTask[],
  order: string[] | undefined,
): ProjectTask[] {
  if (order === undefined || order.length === 0) {
    return tasks
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const seenIds = new Set<string>()
  const ordered: ProjectTask[] = []

  for (const id of order) {
    const task = taskById.get(id)
    if (task === undefined || seenIds.has(id)) {
      continue
    }
    seenIds.add(id)
    ordered.push(task)
  }

  for (const task of tasks) {
    if (!seenIds.has(task.id)) {
      ordered.push(task)
    }
  }

  return ordered
}

export function resolveTaskOrderIds(
  category: TaskCategory,
  order: string[] | undefined,
): string[] {
  return resolveTaskOrder(PROJECT_TASKS_BY_RESET_CYCLE[category], order).map(
    (task) => task.id,
  )
}

export function moveIdInOrder(
  orderedIds: string[],
  taskId: string,
  toIndex: number,
): string[] {
  const fromIndex = orderedIds.indexOf(taskId)
  if (fromIndex === -1) {
    return orderedIds
  }

  const clampedToIndex = Math.max(0, Math.min(toIndex, orderedIds.length - 1))
  if (clampedToIndex === fromIndex) {
    return orderedIds
  }

  const next = [...orderedIds]
  next.splice(fromIndex, 1)
  next.splice(clampedToIndex, 0, taskId)
  return next
}
