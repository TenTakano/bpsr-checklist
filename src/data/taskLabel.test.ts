import { describe, expect, it } from 'vitest'
import { getTaskLabel } from './taskLabel.ts'
import labelsJa from './labels.ja.json'
import upstreamTasks from './upstreamTasks.json'
import type { Task } from './taskSchema.ts'

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'daily_mystery_store',
  label: '🎁 Mystery Store (Buy what you want) | +1 refresh with Season Pass',
  color: 'gold',
  maxProgress: 1,
  optional: false,
  ...overrides,
})

const collectUpstreamTaskIds = (): string[] =>
  [...upstreamTasks.daily, ...upstreamTasks.weekly].map((task) => task.id)

describe('getTaskLabel', () => {
  it('既知の id には日本語ラベルを返す', () => {
    const task = buildTask()
    expect(getTaskLabel(task)).toBe(
      '🎁 神秘ストア（好きな物を購入）| シーズンパスで+1回更新',
    )
  })

  it('未知の id には英語ラベルにフォールバックする', () => {
    const task = buildTask({
      id: 'daily_unknown_task',
      label: '🎯 Unknown Task',
    })
    expect(getTaskLabel(task)).toBe('🎯 Unknown Task')
  })
})

describe('labels.ja.json', () => {
  it('upstream のタスク id と1対1で対応し、欠落・孤児キーがない', () => {
    const upstreamTaskIds = collectUpstreamTaskIds()
    const upstreamTaskIdSet = new Set(upstreamTaskIds)

    const missingIds = upstreamTaskIds.filter(
      (id) => !Object.hasOwn(labelsJa, id),
    )
    const orphanKeys = Object.keys(labelsJa).filter(
      (id) => !upstreamTaskIdSet.has(id),
    )

    expect(missingIds).toEqual([])
    expect(orphanKeys).toEqual([])
  })
})
