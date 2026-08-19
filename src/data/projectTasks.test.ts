import { describe, expect, it } from 'vitest'
import {
  DAILY_TASKS,
  WEEKLY_TASKS,
  findExcludedIdsOverlappingProjectTasks,
  findNonexistentExcludedUpstreamIds,
  findUnmappedUpstreamIds,
  validateProjectTaskDefinitions,
} from './projectTasksResolver'
import { PROJECT_TASKS, EXCLUDED_UPSTREAM_IDS } from './projectTasks'
import upstreamTasksDocumentRaw from './upstreamTasks.json'
import { UpstreamTasksDocumentSchema, type Task } from './taskSchema'

const upstreamDocument = UpstreamTasksDocumentSchema.parse(
  upstreamTasksDocumentRaw,
)

// PROJECT_TASKS is the source of truth for label/color/maxProgress/optional/
// category (every entry specifies them explicitly), so the expected Task[]
// here is built directly from PROJECT_TASKS. This keeps the test from
// failing on routine upstream content changes (e.g. a label wording tweak)
// while still catching id-mapping/categorization regressions in
// projectTasksResolver.
const expectedDaily: Task[] = []
const expectedWeekly: Task[] = []
for (const definition of PROJECT_TASKS) {
  const expectedTask: Task = {
    id: definition.id,
    label: definition.label,
    color: definition.color,
    maxProgress: definition.maxProgress,
    optional: definition.optional,
  }

  if (definition.category === 'daily') {
    expectedDaily.push(expectedTask)
  } else {
    expectedWeekly.push(expectedTask)
  }
}

describe('DAILY_TASKS / WEEKLY_TASKS (resolved from PROJECT_TASKS)', () => {
  it("resolves PROJECT_TASKS into DAILY_TASKS/WEEKLY_TASKS using each entry's own label/color/maxProgress/optional/category", () => {
    expect(DAILY_TASKS).toEqual(expectedDaily)
    expect(WEEKLY_TASKS).toEqual(expectedWeekly)
  })
})

describe('PROJECT_TASKS / EXCLUDED_UPSTREAM_IDS invariants against upstreamTasks.json', () => {
  it('does not throw when validating PROJECT_TASKS against the upstream document', () => {
    expect(() =>
      validateProjectTaskDefinitions(PROJECT_TASKS, upstreamDocument),
    ).not.toThrow()
  })

  it('has no EXCLUDED_UPSTREAM_IDS entry that overlaps PROJECT_TASKS upstreamIds', () => {
    expect(
      findExcludedIdsOverlappingProjectTasks(
        PROJECT_TASKS,
        EXCLUDED_UPSTREAM_IDS,
      ),
    ).toEqual([])
  })

  it('has no EXCLUDED_UPSTREAM_IDS entry missing from the upstream document', () => {
    expect(
      findNonexistentExcludedUpstreamIds(
        EXCLUDED_UPSTREAM_IDS,
        upstreamDocument,
      ),
    ).toEqual([])
  })

  it('has no unmapped upstream id (every upstream id is referenced or excluded)', () => {
    expect(
      findUnmappedUpstreamIds(
        PROJECT_TASKS,
        upstreamDocument,
        EXCLUDED_UPSTREAM_IDS,
      ),
    ).toEqual([])
  })
})
