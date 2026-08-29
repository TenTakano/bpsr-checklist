import type { Character } from '../store/schema'
import type { Store } from '../store/types'

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

// The daily period start defaults to a JST Friday 05:00 game day so
// weekday-limited tasks (guild_dance: Friday only, guild_hunt: Friday-Sunday)
// are visible by default, matching the "all daily tasks shown" assumption
// most existing tests rely on. Tests exercising weekday-based hiding override
// this field explicitly.
const DEFAULT_RESET_STATE = {
  daily: '2026-01-01T20:00:00.000Z',
  weekly: '2025-12-28T20:00:00.000Z',
}

// 2026-02-01T20:00:00.000Z is a JST Monday 05:00 game-day start, so
// guild_hunt (availableWeekdays: [5, 6, 0]) and guild_dance
// (availableWeekdays: [5]) are both unavailable.
export const MONDAY_RESET_STATE = {
  daily: '2026-02-01T20:00:00.000Z',
  weekly: '2026-02-01T20:00:00.000Z',
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
    >
  > = {},
): Store => ({
  schemaVersion: 1,
  taskDataVersion: 'test-commit',
  characters: [DEFAULT_CHARACTER],
  progress: {},
  resetState: DEFAULT_RESET_STATE,
  ...overrides,
})
