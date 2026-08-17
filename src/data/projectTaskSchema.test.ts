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

describe('createProjectTaskDefinitionsSchema', () => {
  it('accepts a valid identity mapping', () => {
    const result = parse([
      { id: 'daily_a', upstreamIds: ['daily_a'] },
      { id: 'weekly_a', upstreamIds: ['weekly_a'] },
    ])
    expect(result.success).toBe(true)
  })

  it('accepts a merge of multiple upstream ids within the same category', () => {
    const result = parse([
      { id: 'daily_merged', upstreamIds: ['daily_a', 'daily_b'] },
    ])
    expect(result.success).toBe(true)
  })

  it('accepts a split when every entry sharing the upstreamId overrides maxProgress', () => {
    const result = parse([
      { id: 'daily_a_part1', upstreamIds: ['daily_a'], maxProgress: 1 },
      { id: 'daily_a_part2', upstreamIds: ['daily_a'], maxProgress: 1 },
    ])
    expect(result.success).toBe(true)
  })

  it.each([
    [
      'duplicate project task ids',
      [
        { id: 'daily_a', upstreamIds: ['daily_a'] },
        { id: 'daily_a', upstreamIds: ['daily_b'] },
      ],
      /id が重複しています/,
    ],
    [
      'a project task whose upstreamIds cross daily/weekly',
      [{ id: 'mixed', upstreamIds: ['daily_a', 'weekly_a'] }],
      /daily\/weekly を跨いでいます/,
    ],
    [
      'a split (shared upstreamId across entries) without a maxProgress override',
      [
        { id: 'daily_a_part1', upstreamIds: ['daily_a'] },
        { id: 'daily_a_part2', upstreamIds: ['daily_a'] },
      ],
      /maxProgress の明示指定が必要です/,
    ],
    [
      'an id containing the __proto__ forbidden identifier',
      [{ id: '__proto__', upstreamIds: ['daily_a'] }],
      /プロトタイプ汚染/,
    ],
    [
      'an id containing the constructor forbidden identifier',
      [{ id: 'constructor', upstreamIds: ['daily_a'] }],
      /プロトタイプ汚染/,
    ],
    [
      'an id containing the prototype forbidden identifier',
      [{ id: 'prototype', upstreamIds: ['daily_a'] }],
      /プロトタイプ汚染/,
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
