import type { CustomTask } from '../data/customTaskSchema'
import type { Character } from '../store/schema'
import type { Store } from '../store/types'

export const buildCustomTask = (
  overrides: Partial<CustomTask> & Pick<CustomTask, 'id' | 'category'>,
): CustomTask => ({
  name: overrides.id,
  color: 'blue',
  maxProgress: 1,
  ...overrides,
})

export const emptyStore = (): Store => ({
  schemaVersion: 1,
  taskDataVersion: 'test-commit',
  characters: [],
  progress: {},
})

export const DEFAULT_CHARACTER: Character = {
  id: 'char-1',
  name: 'Alice',
  createdAt: '2026-01-01T00:00:00.000Z',
}

export const storeWithCharacter = (
  overrides: Partial<
    Pick<
      Store,
      | 'characters'
      | 'progress'
      | 'resetState'
      | 'taskOrder'
      | 'hiddenTaskIds'
      | 'detailedCountTaskIds'
      | 'customTasks'
    >
  > = {},
): Store => ({
  schemaVersion: 1,
  taskDataVersion: 'test-commit',
  characters: [DEFAULT_CHARACTER],
  progress: {},
  ...overrides,
})
