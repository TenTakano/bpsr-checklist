import { describe, expect, it } from 'vitest'
import {
  findExcludedIdsOverlappingProjectTasks,
  findNonexistentExcludedUpstreamIds,
  findUnmappedUpstreamIds,
  resolveProjectTasks,
  validateProjectTaskDefinitions,
} from './projectTasksResolver'
import type { UpstreamTasksDocument } from './taskSchema'
import type { ProjectTaskDefinition } from './projectTaskSchema'

const buildDefinition = (
  overrides: Partial<ProjectTaskDefinition> = {},
): ProjectTaskDefinition => ({
  id: 'daily_a',
  upstreamIds: ['daily_a'],
  label: 'Daily A',
  color: 'blue',
  maxProgress: 2,
  optional: false,
  category: 'daily',
  ...overrides,
})

const buildUpstreamDocument = (): UpstreamTasksDocument => ({
  schemaVersion: 1,
  upstreamCommit: null,
  daily: [
    {
      id: 'daily_a',
      label: 'Daily A',
      color: 'blue',
      maxProgress: 2,
      optional: false,
    },
    {
      id: 'daily_b',
      label: 'Daily B',
      color: 'green',
      maxProgress: 3,
      optional: true,
    },
  ],
  weekly: [
    {
      id: 'weekly_a',
      label: 'Weekly A',
      color: 'gold',
      maxProgress: 1,
      optional: false,
    },
  ],
})

describe('resolveProjectTasks', () => {
  it('resolves an identity mapping to matching daily/weekly Task entries', () => {
    const definitions: ProjectTaskDefinition[] = [
      buildDefinition(),
      {
        id: 'weekly_a',
        upstreamIds: ['weekly_a'],
        label: 'Weekly A',
        color: 'gold',
        maxProgress: 1,
        optional: false,
        category: 'weekly',
      },
    ]
    const result = resolveProjectTasks(definitions)

    expect(result.daily).toEqual([
      {
        id: 'daily_a',
        label: 'Daily A',
        color: 'blue',
        maxProgress: 2,
        optional: false,
      },
    ])
    expect(result.weekly).toEqual([
      {
        id: 'weekly_a',
        label: 'Weekly A',
        color: 'gold',
        maxProgress: 1,
        optional: false,
      },
    ])
  })

  it('uses the definition own label/color/maxProgress/optional even when they differ from the upstream task', () => {
    const definitions: ProjectTaskDefinition[] = [
      buildDefinition({
        label: 'Overridden label',
        color: 'purple',
        maxProgress: 9,
        optional: true,
      }),
    ]
    const result = resolveProjectTasks(definitions)

    expect(result.daily[0]).toEqual({
      id: 'daily_a',
      label: 'Overridden label',
      color: 'purple',
      maxProgress: 9,
      optional: true,
    })
  })

  it('resolves a merge of multiple upstreamIds using the definition own explicit fields', () => {
    const definitions: ProjectTaskDefinition[] = [
      {
        id: 'daily_merged',
        upstreamIds: ['daily_a', 'daily_b'],
        label: 'Daily Merged',
        color: 'blue',
        maxProgress: 5,
        optional: false,
        category: 'daily',
      },
    ]
    const result = resolveProjectTasks(definitions)

    expect(result.daily).toEqual([
      {
        id: 'daily_merged',
        label: 'Daily Merged',
        color: 'blue',
        maxProgress: 5,
        optional: false,
      },
    ])
  })

  it('resolves a project-only task (empty upstreamIds) using its explicit fields', () => {
    const definitions: ProjectTaskDefinition[] = [
      {
        id: 'project_only',
        upstreamIds: [],
        label: 'Project Only',
        color: 'purple',
        maxProgress: 3,
        optional: true,
        category: 'weekly',
      },
    ]
    const result = resolveProjectTasks(definitions)

    expect(result.weekly).toEqual([
      {
        id: 'project_only',
        label: 'Project Only',
        color: 'purple',
        maxProgress: 3,
        optional: true,
      },
    ])
    expect(result.daily).toEqual([])
  })

  it('lets a project-only task (empty upstreamIds) coexist with merge/split entries', () => {
    const definitions: ProjectTaskDefinition[] = [
      buildDefinition(),
      {
        id: 'project_only',
        upstreamIds: [],
        label: 'Project Only',
        color: 'purple',
        maxProgress: 1,
        optional: false,
        category: 'daily',
      },
    ]
    const result = resolveProjectTasks(definitions)

    expect(result.daily.map((task) => task.id)).toEqual([
      'daily_a',
      'project_only',
    ])
  })

  it('does not throw on definitions that would fail validateProjectTaskDefinitions (e.g. unknown upstreamId, duplicate ids)', () => {
    const definitionsWithUnknownUpstreamId: ProjectTaskDefinition[] = [
      {
        id: 'daily_unknown',
        upstreamIds: ['daily_does_not_exist'],
        label: 'Daily Unknown',
        color: 'blue',
        maxProgress: 1,
        optional: false,
        category: 'daily',
      },
    ]
    expect(() =>
      resolveProjectTasks(definitionsWithUnknownUpstreamId),
    ).not.toThrow()

    const definitionsWithDuplicateIds: ProjectTaskDefinition[] = [
      buildDefinition(),
      buildDefinition({
        upstreamIds: ['daily_b'],
        label: 'Daily B',
        color: 'green',
        maxProgress: 3,
        optional: true,
      }),
    ]
    expect(() => resolveProjectTasks(definitionsWithDuplicateIds)).not.toThrow()
  })
})

describe('validateProjectTaskDefinitions', () => {
  it('throws when a definition references an unknown upstreamId', () => {
    const definitions: ProjectTaskDefinition[] = [
      {
        id: 'daily_unknown',
        upstreamIds: ['daily_does_not_exist'],
        label: 'Daily Unknown',
        color: 'blue',
        maxProgress: 1,
        optional: false,
        category: 'daily',
      },
    ]
    expect(() =>
      validateProjectTaskDefinitions(definitions, buildUpstreamDocument()),
    ).toThrow(/daily_does_not_exist/)
  })

  it('reports the unknown-upstreamId error before the category-mismatch error when a definition has both problems', () => {
    const definitions: ProjectTaskDefinition[] = [
      {
        id: 'daily_bad',
        upstreamIds: ['daily_a', 'daily_does_not_exist'],
        label: 'Daily Bad',
        color: 'blue',
        maxProgress: 2,
        optional: false,
        // Mismatches daily_a's resolved category ('daily') too, so this
        // definition is invalid for two reasons: the reference-integrity
        // check must win and report the unknown upstreamId.
        category: 'weekly',
      },
    ]
    expect(() =>
      validateProjectTaskDefinitions(definitions, buildUpstreamDocument()),
    ).toThrow(/daily_does_not_exist/)
  })

  it('throws when the definitions violate structural invariants (e.g. duplicate ids)', () => {
    const definitions: ProjectTaskDefinition[] = [
      buildDefinition(),
      buildDefinition({
        upstreamIds: ['daily_b'],
        label: 'Daily B',
        color: 'green',
        maxProgress: 3,
        optional: true,
      }),
    ]
    expect(() =>
      validateProjectTaskDefinitions(definitions, buildUpstreamDocument()),
    ).toThrow()
  })
})

describe('findUnmappedUpstreamIds', () => {
  it('returns an empty array when every upstream task is referenced', () => {
    const definitions: ProjectTaskDefinition[] = [
      buildDefinition(),
      buildDefinition({ id: 'daily_b', upstreamIds: ['daily_b'] }),
      buildDefinition({
        id: 'weekly_a',
        upstreamIds: ['weekly_a'],
        category: 'weekly',
      }),
    ]
    expect(
      findUnmappedUpstreamIds(definitions, buildUpstreamDocument()),
    ).toEqual([])
  })

  it('returns upstream ids that no definition references (e.g. missing mapping for a new upstream task)', () => {
    const definitions: ProjectTaskDefinition[] = [
      buildDefinition(),
      buildDefinition({
        id: 'weekly_a',
        upstreamIds: ['weekly_a'],
        category: 'weekly',
      }),
    ]
    expect(
      findUnmappedUpstreamIds(definitions, buildUpstreamDocument()),
    ).toEqual(['daily_b'])
  })

  it('excludes ids listed in excludedUpstreamIds from the unmapped result, without hiding other unmapped ids', () => {
    const definitions: ProjectTaskDefinition[] = [buildDefinition()]
    expect(
      findUnmappedUpstreamIds(definitions, buildUpstreamDocument(), [
        'daily_b',
      ]),
    ).toEqual(['weekly_a'])
  })
})

describe('findExcludedIdsOverlappingProjectTasks', () => {
  it('returns an empty array when no excluded id is referenced by any definition', () => {
    const definitions: ProjectTaskDefinition[] = [buildDefinition()]
    expect(
      findExcludedIdsOverlappingProjectTasks(definitions, ['daily_b']),
    ).toEqual([])
  })

  it('returns excluded ids that a definition still references', () => {
    const definitions: ProjectTaskDefinition[] = [buildDefinition()]
    expect(
      findExcludedIdsOverlappingProjectTasks(definitions, ['daily_a']),
    ).toEqual(['daily_a'])
  })
})

describe('findNonexistentExcludedUpstreamIds', () => {
  it('returns an empty array when every excluded id exists in the upstream document', () => {
    expect(
      findNonexistentExcludedUpstreamIds(['daily_b'], buildUpstreamDocument()),
    ).toEqual([])
  })

  it('returns excluded ids that do not exist in the upstream document', () => {
    expect(
      findNonexistentExcludedUpstreamIds(
        ['daily_does_not_exist'],
        buildUpstreamDocument(),
      ),
    ).toEqual(['daily_does_not_exist'])
  })
})
