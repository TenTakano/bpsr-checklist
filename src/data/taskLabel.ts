import labelsJa from './labels.ja.json'
import type { Task } from './taskSchema.ts'

const JA_LABELS: Record<string, string> = labelsJa

export const getTaskLabel = (task: Task): string =>
  Object.hasOwn(JA_LABELS, task.id) ? JA_LABELS[task.id] : task.label
