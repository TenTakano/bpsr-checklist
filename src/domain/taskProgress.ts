export const isTaskComplete = (value: number, maxProgress: number): boolean =>
  value >= maxProgress
