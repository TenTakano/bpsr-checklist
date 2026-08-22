import type { ResetCycle } from './resetCycle'

export interface TaskSection {
  title: string
  cycle: ResetCycle
}

export const TASK_SECTIONS: TaskSection[] = [
  { title: 'デイリー', cycle: 'daily' },
  { title: 'ウィークリー', cycle: 'weekly' },
]
