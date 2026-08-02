import labelsJa from './labels.ja.json'
import type { Task } from './taskSchema.ts'

const JA_LABELS: Record<string, string> = labelsJa

export const getTaskLabel = (task: Task): string =>
  Object.hasOwn(JA_LABELS, task.id) ? JA_LABELS[task.id] : task.label

export interface SplitTaskLabel {
  primary: string
  note: string | null
}

const OPEN_PARENS = new Set(['(', '（'])
const CLOSE_PARENS = new Set([')', '）'])

export const splitTaskLabel = (label: string): SplitTaskLabel => {
  let depth = 0
  for (let index = 0; index < label.length; index++) {
    const char = label[index]
    if (OPEN_PARENS.has(char)) {
      depth += 1
    } else if (CLOSE_PARENS.has(char)) {
      depth = Math.max(0, depth - 1)
    } else if (char === '|' && depth === 0) {
      const note = label.slice(index + 1).trim()
      return {
        primary: label.slice(0, index).trimEnd(),
        note: note.length > 0 ? note : null,
      }
    }
  }
  return { primary: label, note: null }
}
