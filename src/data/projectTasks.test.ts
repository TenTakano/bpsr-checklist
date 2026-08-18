import { describe, expect, it } from 'vitest'
import { DAILY_TASKS, WEEKLY_TASKS } from './projectTasksResolver'
import { PROJECT_TASKS } from './projectTasks'
import { UpstreamTasksDocumentSchema, type Task } from './taskSchema'
import type { TaskCategory } from './taskLookup'
import type { ProjectTaskDefinition } from './projectTaskSchema'
import upstreamTasksDocumentRaw from './upstreamTasks.json'

// PROJECT_TASKS is the source of truth for label/color/maxProgress/optional
// (every entry specifies them explicitly), so the expected Task[] here is
// built directly from PROJECT_TASKS instead of from upstreamTasks.json.
// Only the daily/weekly category still comes from the upstream document,
// since that grouping is structural (which array an upstreamId lives in),
// not a value PROJECT_TASKS owns. This keeps the test from failing on
// routine upstream content changes (e.g. a label wording tweak) while still
// catching id-mapping/categorization regressions in projectTasksResolver.
const upstreamTasksDocument = UpstreamTasksDocumentSchema.parse(
  upstreamTasksDocumentRaw,
)

const upstreamCategoryById = new Map<string, TaskCategory>()
for (const task of upstreamTasksDocument.daily) {
  upstreamCategoryById.set(task.id, 'daily')
}
for (const task of upstreamTasksDocument.weekly) {
  upstreamCategoryById.set(task.id, 'weekly')
}

const expectedDaily: Task[] = []
const expectedWeekly: Task[] = []
for (const definition of PROJECT_TASKS) {
  // upstreamIds: [] entries are project-only tasks (docs/task-layers.md):
  // they have no upstream id to look up a category from, so they specify
  // daily/weekly directly via `category`.
  const isProjectOnly = definition.upstreamIds.length === 0
  const category = isProjectOnly
    ? (definition as ProjectTaskDefinition).category
    : upstreamCategoryById.get(definition.upstreamIds[0])
  if (category === undefined) {
    throw new Error(`upstream category not found for: ${definition.id}`)
  }

  const expectedTask: Task = {
    id: definition.id,
    label: definition.label,
    color: definition.color,
    maxProgress: definition.maxProgress,
    optional: definition.optional,
  }

  if (category === 'daily') {
    expectedDaily.push(expectedTask)
  } else {
    expectedWeekly.push(expectedTask)
  }
}

describe('DAILY_TASKS / WEEKLY_TASKS (resolved from PROJECT_TASKS)', () => {
  it("resolves PROJECT_TASKS into DAILY_TASKS/WEEKLY_TASKS using each entry's own label/color/maxProgress/optional, grouped by upstream category", () => {
    expect(DAILY_TASKS).toEqual(expectedDaily)
    expect(WEEKLY_TASKS).toEqual(expectedWeekly)
  })
})
