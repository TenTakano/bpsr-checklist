import { describe, expect, it } from 'vitest'
import {
  findExcludedIdsOverlappingProjectTasks,
  findNonexistentExcludedUpstreamIds,
  findUnmappedUpstreamIds,
  resolveProjectTasks,
} from './projectTasksResolver'
import type { UpstreamTasksDocument } from './taskSchema'
import type { ProjectTaskDefinition } from './projectTaskSchema'

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
      { id: 'daily_a', upstreamIds: ['daily_a'] },
      { id: 'weekly_a', upstreamIds: ['weekly_a'] },
    ]
    const result = resolveProjectTasks(definitions, buildUpstreamDocument())

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

  it('sums maxProgress across merged upstreamIds by default', () => {
    const definitions: ProjectTaskDefinition[] = [
      { id: 'daily_merged', upstreamIds: ['daily_a', 'daily_b'] },
    ]
    const result = resolveProjectTasks(definitions, buildUpstreamDocument())

    expect(result.daily[0].maxProgress).toBe(5)
  })

  it('inherits label/color/optional from the first upstreamId when not overridden', () => {
    const definitions: ProjectTaskDefinition[] = [
      { id: 'daily_merged', upstreamIds: ['daily_b', 'daily_a'] },
    ]
    const result = resolveProjectTasks(definitions, buildUpstreamDocument())

    expect(result.daily[0].label).toBe('Daily B')
    expect(result.daily[0].color).toBe('green')
    expect(result.daily[0].optional).toBe(true)
  })

  it('applies label/color/maxProgress/optional overrides when provided', () => {
    const definitions: ProjectTaskDefinition[] = [
      {
        id: 'daily_a',
        upstreamIds: ['daily_a'],
        label: 'Overridden label',
        color: 'purple',
        maxProgress: 9,
        optional: true,
      },
    ]
    const result = resolveProjectTasks(definitions, buildUpstreamDocument())

    expect(result.daily[0]).toEqual({
      id: 'daily_a',
      label: 'Overridden label',
      color: 'purple',
      maxProgress: 9,
      optional: true,
    })
  })

  it('resolves a project-only task (empty upstreamIds) using its explicit fields', () => {
    const definitions: ProjectTaskDefinition[] = [
      {
        id: 'project_only',
        upstreamIds: [],
        label: 'Project Only',
        color: 'purple',
        maxProgress: 3,
        category: 'weekly',
      },
    ]
    const result = resolveProjectTasks(definitions, buildUpstreamDocument())

    expect(result.weekly).toEqual([
      {
        id: 'project_only',
        label: 'Project Only',
        color: 'purple',
        maxProgress: 3,
        optional: false,
      },
    ])
    expect(result.daily).toEqual([])
  })

  it('defaults optional to false for a project-only task when not specified', () => {
    const definitions: ProjectTaskDefinition[] = [
      {
        id: 'project_only',
        upstreamIds: [],
        label: 'Project Only',
        color: 'purple',
        maxProgress: 1,
        category: 'daily',
      },
    ]
    const result = resolveProjectTasks(definitions, buildUpstreamDocument())

    expect(result.daily[0].optional).toBe(false)
  })

  it('applies an explicit optional: true for a project-only task', () => {
    const definitions: ProjectTaskDefinition[] = [
      {
        id: 'project_only',
        upstreamIds: [],
        label: 'Project Only',
        color: 'purple',
        maxProgress: 1,
        category: 'daily',
        optional: true,
      },
    ]
    const result = resolveProjectTasks(definitions, buildUpstreamDocument())

    expect(result.daily[0].optional).toBe(true)
  })

  it('lets a project-only task (empty upstreamIds) coexist with merge/split entries without tripping their cross validations', () => {
    const definitions: ProjectTaskDefinition[] = [
      { id: 'daily_a', upstreamIds: ['daily_a'] },
      {
        id: 'project_only',
        upstreamIds: [],
        label: 'Project Only',
        color: 'purple',
        maxProgress: 1,
        category: 'daily',
      },
    ]
    const result = resolveProjectTasks(definitions, buildUpstreamDocument())

    expect(result.daily.map((task) => task.id)).toEqual([
      'daily_a',
      'project_only',
    ])
  })

  it('throws when a definition references an unknown upstreamId', () => {
    const definitions: ProjectTaskDefinition[] = [
      { id: 'daily_unknown', upstreamIds: ['daily_does_not_exist'] },
    ]
    expect(() =>
      resolveProjectTasks(definitions, buildUpstreamDocument()),
    ).toThrow(/daily_does_not_exist/)
  })

  it('throws when the definitions violate structural invariants (e.g. duplicate ids)', () => {
    const definitions: ProjectTaskDefinition[] = [
      { id: 'daily_a', upstreamIds: ['daily_a'] },
      { id: 'daily_a', upstreamIds: ['daily_b'] },
    ]
    expect(() =>
      resolveProjectTasks(definitions, buildUpstreamDocument()),
    ).toThrow()
  })
})

describe('findUnmappedUpstreamIds', () => {
  it('returns an empty array when every upstream task is referenced', () => {
    const definitions: ProjectTaskDefinition[] = [
      { id: 'daily_a', upstreamIds: ['daily_a'] },
      { id: 'daily_b', upstreamIds: ['daily_b'] },
      { id: 'weekly_a', upstreamIds: ['weekly_a'] },
    ]
    expect(
      findUnmappedUpstreamIds(definitions, buildUpstreamDocument()),
    ).toEqual([])
  })

  it('returns upstream ids that no definition references (e.g. missing mapping for a new upstream task)', () => {
    const definitions: ProjectTaskDefinition[] = [
      { id: 'daily_a', upstreamIds: ['daily_a'] },
      { id: 'weekly_a', upstreamIds: ['weekly_a'] },
    ]
    expect(
      findUnmappedUpstreamIds(definitions, buildUpstreamDocument()),
    ).toEqual(['daily_b'])
  })

  it('excludes ids listed in excludedUpstreamIds from the unmapped result, without hiding other unmapped ids', () => {
    const definitions: ProjectTaskDefinition[] = [
      { id: 'daily_a', upstreamIds: ['daily_a'] },
    ]
    expect(
      findUnmappedUpstreamIds(definitions, buildUpstreamDocument(), [
        'daily_b',
      ]),
    ).toEqual(['weekly_a'])
  })
})

describe('findExcludedIdsOverlappingProjectTasks', () => {
  it('returns an empty array when no excluded id is referenced by any definition', () => {
    const definitions: ProjectTaskDefinition[] = [
      { id: 'daily_a', upstreamIds: ['daily_a'] },
    ]
    expect(
      findExcludedIdsOverlappingProjectTasks(definitions, ['daily_b']),
    ).toEqual([])
  })

  it('returns excluded ids that a definition still references', () => {
    const definitions: ProjectTaskDefinition[] = [
      { id: 'daily_a', upstreamIds: ['daily_a'] },
    ]
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
