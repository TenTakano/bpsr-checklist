import { describe, expect, it } from 'vitest'
import {
  PROJECT_TASKS_BY_RESET_CYCLE,
  findExcludedIdsOverlappingProjectTasks,
  findNonexistentExcludedUpstreamIds,
  findUnmappedUpstreamIds,
  validateProjectTaskDefinitions,
} from './projectTasksResolver'
import {
  PROJECT_TASKS,
  EXCLUDED_UPSTREAM_IDS,
  RESET_CYCLE_OVERRIDE_IDS,
} from './projectTasks'
import upstreamTasksDocumentRaw from './upstreamTasks.json'
import { UpstreamTasksDocumentSchema } from './taskSchema'
import type { ProjectTask } from './projectTaskSchema'

const upstreamDocument = UpstreamTasksDocumentSchema.parse(
  upstreamTasksDocumentRaw,
)

// PROJECT_TASKS is the source of truth for label/color/maxProgress/optional/
// resetCycle (every entry specifies them explicitly), so the expected
// ProjectTask[] here is built directly from PROJECT_TASKS. This keeps the
// test from failing on routine upstream content changes (e.g. a label
// wording tweak) while still catching id-mapping/resetCycle regressions in
// projectTasksResolver.
const expectedDaily: ProjectTask[] = []
const expectedWeekly: ProjectTask[] = []
for (const definition of PROJECT_TASKS) {
  const expectedTask: ProjectTask = {
    id: definition.id,
    label: definition.label,
    color: definition.color,
    maxProgress: definition.maxProgress,
    optional: definition.optional,
    resetCycle: definition.resetCycle,
  }

  if (definition.resetCycle === 'daily') {
    expectedDaily.push(expectedTask)
  } else {
    expectedWeekly.push(expectedTask)
  }
}

describe('PROJECT_TASKS_BY_RESET_CYCLE (resolved from PROJECT_TASKS)', () => {
  it("resolves PROJECT_TASKS into PROJECT_TASKS_BY_RESET_CYCLE using each entry's own label/color/maxProgress/optional/resetCycle", () => {
    expect(PROJECT_TASKS_BY_RESET_CYCLE.daily).toEqual(expectedDaily)
    expect(PROJECT_TASKS_BY_RESET_CYCLE.weekly).toEqual(expectedWeekly)
  })
})

describe('PROJECT_TASKS / EXCLUDED_UPSTREAM_IDS invariants against upstreamTasks.json', () => {
  it('does not throw when validating PROJECT_TASKS against the upstream document', () => {
    expect(() =>
      validateProjectTaskDefinitions(
        PROJECT_TASKS,
        upstreamDocument,
        RESET_CYCLE_OVERRIDE_IDS,
      ),
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
