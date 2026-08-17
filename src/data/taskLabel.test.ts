import { describe, expect, it } from 'vitest'
import {
  getTaskLabel,
  splitTaskLabel,
  type SplitTaskLabel,
} from './taskLabel.ts'
import labelsJa from './labels.ja.json'
import { DAILY_TASKS, WEEKLY_TASKS } from './projectTasksResolver.ts'
import type { Task } from './taskSchema.ts'

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'mystery_store',
  label: '🎁 Mystery Store (Buy what you want) | +1 refresh with Season Pass',
  color: 'gold',
  maxProgress: 1,
  optional: false,
  ...overrides,
})

const collectProjectTaskIds = (): string[] =>
  [...DAILY_TASKS, ...WEEKLY_TASKS].map((task) => task.id)

describe('getTaskLabel', () => {
  it('既知の id には日本語ラベルを返す', () => {
    const task = buildTask()
    expect(getTaskLabel(task)).toBe(
      '🎁 神秘ストア（好きな物を購入）| シーズンパスで+1回更新',
    )
  })

  it('未知の id には英語ラベルにフォールバックする', () => {
    const task = buildTask({
      id: 'unknown_task',
      label: '🎯 Unknown Task',
    })
    expect(getTaskLabel(task)).toBe('🎯 Unknown Task')
  })
})

describe('labels.ja.json', () => {
  it('プロジェクトタスク id と1対1で対応し、欠落・孤児キーがない', () => {
    const projectTaskIds = collectProjectTaskIds()
    const projectTaskIdSet = new Set(projectTaskIds)

    const missingIds = projectTaskIds.filter(
      (id) => !Object.hasOwn(labelsJa, id),
    )
    const orphanKeys = Object.keys(labelsJa).filter(
      (id) => !projectTaskIdSet.has(id),
    )

    expect(missingIds).toEqual([])
    expect(orphanKeys).toEqual([])
  })
})

describe('splitTaskLabel', () => {
  it.each([
    [
      '括弧の外側にある最初の "|" で本文と補足に分割する',
      labelsJa.mystery_store,
      {
        primary: '🎁 神秘ストア（好きな物を購入）',
        note: 'シーズンパスで+1回更新',
      },
    ],
    [
      '括弧の前にある "|" でも本文と補足に分割する',
      labelsJa.bureau_commissions,
      { primary: '📋 開拓局の依頼', note: '最大2日スキップ可（依頼9件）' },
    ],
    [
      '括弧内の "|" では分割しない (s3_raids_easy)',
      labelsJa.s3_raids_easy,
      { primary: labelsJa.s3_raids_easy, note: null },
    ],
    [
      '括弧内の "|" では分割しない (s3_raids_hard)',
      labelsJa.s3_raids_hard,
      { primary: labelsJa.s3_raids_hard, note: null },
    ],
    [
      '"|" を含まない場合は note が null になる',
      labelsJa.unstable_clear,
      { primary: labelsJa.unstable_clear, note: null },
    ],
    [
      '閉じ括弧が開き括弧より先に現れても depth が負にならず、括弧内の "|" を誤って分割しない',
      ')(foo|bar)|baz',
      { primary: ')(foo|bar)', note: 'baz' },
    ],
  ] satisfies [string, string, SplitTaskLabel][])(
    '%s',
    (_description, label, expected) => {
      expect(splitTaskLabel(label)).toEqual(expected)
    },
  )
})
