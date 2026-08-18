import { describe, expect, it } from 'vitest'
import {
  createProjectTaskDefinitionsSchema,
  type ProjectTaskDefinition,
} from './projectTaskSchema'
import type { TaskCategory } from './taskLookup'

const CATEGORY_BY_UPSTREAM_ID: Record<string, TaskCategory> = {
  daily_a: 'daily',
  daily_b: 'daily',
  weekly_a: 'weekly',
  weekly_b: 'weekly',
}

const resolveCategory = (upstreamId: string): TaskCategory | null =>
  CATEGORY_BY_UPSTREAM_ID[upstreamId] ?? null

const parse = (definitions: ProjectTaskDefinition[]) =>
  createProjectTaskDefinitionsSchema(resolveCategory).safeParse(definitions)

const buildDailyA = (
  overrides: Partial<ProjectTaskDefinition> = {},
): ProjectTaskDefinition => ({
  id: 'daily_a',
  upstreamIds: ['daily_a'],
  label: 'Daily A',
  color: 'blue',
  maxProgress: 1,
  optional: false,
  category: 'daily',
  ...overrides,
})

const buildProjectOnly = (
  overrides: Partial<ProjectTaskDefinition> = {},
): ProjectTaskDefinition => ({
  id: 'project_only',
  upstreamIds: [],
  label: 'Project Only',
  color: 'purple',
  maxProgress: 1,
  optional: false,
  category: 'daily',
  ...overrides,
})

const buildWeeklyA = (
  overrides: Partial<ProjectTaskDefinition> = {},
): ProjectTaskDefinition => ({
  id: 'weekly_a',
  upstreamIds: ['weekly_a'],
  label: 'Weekly A',
  color: 'gold',
  maxProgress: 1,
  optional: false,
  category: 'weekly',
  ...overrides,
})

describe('createProjectTaskDefinitionsSchema', () => {
  it('accepts a valid identity mapping', () => {
    const result = parse([buildDailyA(), buildWeeklyA()])
    expect(result.success).toBe(true)
  })

  it('accepts a merge of multiple upstream ids within the same category', () => {
    const result = parse([
      {
        id: 'daily_merged',
        upstreamIds: ['daily_a', 'daily_b'],
        label: 'Daily Merged',
        color: 'blue',
        maxProgress: 5,
        optional: false,
        category: 'daily',
      },
    ])
    expect(result.success).toBe(true)
  })

  it('accepts multiple entries sharing the same upstreamId (a split)', () => {
    const result = parse([
      buildDailyA({ id: 'daily_a_part1', maxProgress: 1 }),
      buildDailyA({ id: 'daily_a_part2', maxProgress: 1 }),
    ])
    expect(result.success).toBe(true)
  })

  it('accepts a project-only task with all five required fields specified', () => {
    const result = parse([buildProjectOnly()])
    expect(result.success).toBe(true)
  })

  it('does not apply the category match check to a project-only task (no upstreamIds to resolve from)', () => {
    const result = parse([buildProjectOnly({ category: 'weekly' })])
    expect(result.success).toBe(true)
  })

  it('excludes an upstreamId unknown to resolveUpstreamCategory from the category match check, so it does not cause a false-positive mismatch', () => {
    const result = parse([
      buildDailyA({ upstreamIds: ['daily_a', 'daily_does_not_exist'] }),
    ])
    expect(result.success).toBe(true)
  })

  it.each(['label', 'color', 'maxProgress', 'optional', 'category'] as const)(
    'rejects a definition missing the required field %s (zod default required-field error)',
    (missingField) => {
      const fullDefinition = buildDailyA()
      const incomplete = { ...fullDefinition }
      delete (incomplete as Record<string, unknown>)[missingField]

      const result = parse([incomplete as unknown as ProjectTaskDefinition])

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.path[1] === missingField),
        ).toBe(true)
      }
    },
  )

  it.each([
    [
      'duplicate project task ids',
      [buildDailyA(), buildDailyA({ upstreamIds: ['daily_b'] })],
      /id が重複しています/,
    ],
    [
      'a project task whose upstreamIds cross daily/weekly',
      [
        {
          id: 'mixed',
          upstreamIds: ['daily_a', 'weekly_a'],
          label: 'Mixed',
          color: 'blue',
          maxProgress: 1,
          optional: false,
          category: 'daily',
        },
      ],
      /daily\/weekly を跨いでいます/,
    ],
    [
      'an id containing the __proto__ forbidden identifier',
      [buildDailyA({ id: '__proto__' })],
      /プロトタイプ汚染/,
    ],
    [
      'an id containing the constructor forbidden identifier',
      [buildDailyA({ id: 'constructor' })],
      /プロトタイプ汚染/,
    ],
    [
      'an id containing the prototype forbidden identifier',
      [buildDailyA({ id: 'prototype' })],
      /プロトタイプ汚染/,
    ],
    [
      'a non-empty upstreamIds entry whose declared category (weekly) does not match the resolved category (daily)',
      [buildDailyA({ category: 'weekly' })],
      /category .*が upstreamIds から解決されるカテゴリと一致しません/,
    ],
    [
      'a non-empty upstreamIds entry whose declared category (daily) does not match the resolved category (weekly)',
      [buildWeeklyA({ category: 'daily' })],
      /category .*が upstreamIds から解決されるカテゴリと一致しません/,
    ],
  ] satisfies [string, ProjectTaskDefinition[], RegExp][])(
    'rejects %s',
    (_description, definitions, expectedMessage) => {
      const result = parse(definitions)
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(
          result.error.issues.some((issue) =>
            expectedMessage.test(issue.message),
          ),
        ).toBe(true)
      }
    },
  )
})
