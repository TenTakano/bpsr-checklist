import type { ResetCycle } from './resetCycle'
import type { TaskCategory } from './taskLookup'

export interface TaskSection {
  title: string
  cycle: ResetCycle
}

export const TASK_SECTIONS: TaskSection[] = [
  { title: 'デイリー', cycle: 'daily' },
  { title: 'ウィークリー', cycle: 'weekly' },
]

export interface MatrixTaskSection {
  title: string
  category: TaskCategory
}

export const MATRIX_TASK_SECTIONS: MatrixTaskSection[] = [
  { title: 'デイリー', category: 'daily' },
  { title: 'ウィークリー', category: 'weekly' },
  { title: 'マイルストーン', category: 'milestone' },
]
