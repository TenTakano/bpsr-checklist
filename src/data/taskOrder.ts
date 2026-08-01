import upstreamTasksDocument from './upstreamTasks.json'
import type { Task } from './taskSchema'
import type { TaskCategory } from './taskLookup'

const TASKS_BY_CATEGORY: Record<TaskCategory, Task[]> = {
  daily: upstreamTasksDocument.daily,
  weekly: upstreamTasksDocument.weekly,
}

export function resolveTaskOrder(
  tasks: Task[],
  order: string[] | undefined,
): Task[] {
  if (order === undefined || order.length === 0) {
    return tasks
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]))
  const seenIds = new Set<string>()
  const ordered: Task[] = []

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
  return resolveTaskOrder(TASKS_BY_CATEGORY[category], order).map(
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
