import type { Task } from '../data/taskSchema'

export const isTaskAvailableOnWeekday = (
  task: Task,
  weekdayJst: number,
): boolean => {
  if (task.availableWeekdays === undefined) {
    return true
  }
  return task.availableWeekdays.includes(weekdayJst)
}

// Combines manually hidden tasks with tasks unavailable on the current
// (game-day) weekday into a single exclusion list. Both display screens
// (MatrixView, SummaryPanel) apply this identically so their filtering
// criteria never drift apart.
export const getExcludedTaskIds = (
  tasks: Task[],
  hiddenTaskIds: string[] | undefined,
  currentWeekdayJst: number | undefined,
): string[] => {
  const weekdayUnavailableTaskIds =
    currentWeekdayJst === undefined
      ? []
      : tasks
          .filter((task) => !isTaskAvailableOnWeekday(task, currentWeekdayJst))
          .map((task) => task.id)
  return [...(hiddenTaskIds ?? []), ...weekdayUnavailableTaskIds]
}
