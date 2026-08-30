import type { Character, CustomTask, ResetState, TaskOrder } from './schema'

// Store is the app's domain state type, distinct in shape from StoreSchema
// (whose characters/progress fields hold pre-validation unknown values), so
// it is hand-written here rather than derived via z.infer.
export interface Store {
  schemaVersion: number
  taskDataVersion: string | null
  characters: Character[]
  progress: Record<string, Record<string, number>>
  resetState?: ResetState
  taskOrder?: TaskOrder
  hiddenTaskIds?: string[]
  detailedCountTaskIds?: string[]
  customTasks?: CustomTask[]
}
