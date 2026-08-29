import type { UpstreamTasksDocument } from './taskSchema'
import {
  createProjectTaskDefinitionsSchema,
  type ProjectTask,
  type ProjectTaskDefinition,
} from './projectTaskSchema'
import { RESET_CYCLES, type ResetCycle } from './resetCycle'
import { PROJECT_TASKS } from './projectTasks'

export type ResolvedProjectTasks = Record<ResetCycle, ProjectTask[]>

function validateUpstreamIdsExist(
  definitions: ProjectTaskDefinition[],
  upstreamCycleById: Map<string, ResetCycle>,
): void {
  for (const definition of definitions) {
    for (const upstreamId of definition.upstreamIds) {
      if (!upstreamCycleById.has(upstreamId)) {
        throw new Error(
          `プロジェクトタスク ${definition.id} が参照する upstreamId "${upstreamId}" が upstreamTasks.json に存在しません`,
        )
      }
    }
  }
}

function buildUpstreamCycleById(
  upstreamDocument: UpstreamTasksDocument,
): Map<string, ResetCycle> {
  const upstreamCycleById = new Map<string, ResetCycle>()
  for (const task of upstreamDocument.daily) {
    upstreamCycleById.set(task.id, 'daily')
  }
  for (const task of upstreamDocument.weekly) {
    upstreamCycleById.set(task.id, 'weekly')
  }
  return upstreamCycleById
}

export function validateProjectTaskDefinitions(
  definitions: ProjectTaskDefinition[],
  upstreamDocument: UpstreamTasksDocument,
  resetCycleOverrideIds: string[] = [],
): void {
  const upstreamCycleById = buildUpstreamCycleById(upstreamDocument)

  validateUpstreamIdsExist(definitions, upstreamCycleById)

  const definitionsSchema = createProjectTaskDefinitionsSchema(
    (upstreamId) => upstreamCycleById.get(upstreamId) ?? null,
    new Set(resetCycleOverrideIds),
  )
  definitionsSchema.parse(definitions)
}

// Kept separate from code paths that read resetCycle directly, so the
// display section can diverge from resetCycle later by changing only this
// function. See docs/task-layers.md ("表示セクションと resetCycle の分離").
function sectionOf(definition: ProjectTaskDefinition): ResetCycle {
  return definition.resetCycle
}

export function resolveProjectTasks(
  definitions: ProjectTaskDefinition[],
): ResolvedProjectTasks {
  const resolved = Object.fromEntries(
    RESET_CYCLES.map((cycle) => [cycle, [] as ProjectTask[]]),
  ) as ResolvedProjectTasks

  for (const definition of definitions) {
    const task: ProjectTask = {
      id: definition.id,
      label: definition.label,
      color: definition.color,
      maxProgress: definition.maxProgress,
      optional: definition.optional,
      resetCycle: definition.resetCycle,
      ...(definition.availableWeekdays !== undefined && {
        availableWeekdays: definition.availableWeekdays,
      }),
    }
    resolved[sectionOf(definition)].push(task)
  }

  return resolved
}

function collectReferencedUpstreamIds(
  definitions: ProjectTaskDefinition[],
): Set<string> {
  return new Set(definitions.flatMap((definition) => definition.upstreamIds))
}

function listUpstreamIds(upstreamDocument: UpstreamTasksDocument): string[] {
  return [...upstreamDocument.daily, ...upstreamDocument.weekly].map(
    (task) => task.id,
  )
}

export function findUnmappedUpstreamIds(
  definitions: ProjectTaskDefinition[],
  upstreamDocument: UpstreamTasksDocument,
  excludedUpstreamIds: string[] = [],
): string[] {
  const referencedUpstreamIds = collectReferencedUpstreamIds(definitions)
  const excludedUpstreamIdSet = new Set(excludedUpstreamIds)
  return listUpstreamIds(upstreamDocument).filter(
    (upstreamId) =>
      !referencedUpstreamIds.has(upstreamId) &&
      !excludedUpstreamIdSet.has(upstreamId),
  )
}

export function findExcludedIdsOverlappingProjectTasks(
  definitions: ProjectTaskDefinition[],
  excludedUpstreamIds: string[],
): string[] {
  const referencedUpstreamIds = collectReferencedUpstreamIds(definitions)
  return excludedUpstreamIds.filter((excludedUpstreamId) =>
    referencedUpstreamIds.has(excludedUpstreamId),
  )
}

export function findNonexistentExcludedUpstreamIds(
  excludedUpstreamIds: string[],
  upstreamDocument: UpstreamTasksDocument,
): string[] {
  const upstreamIdSet = new Set(listUpstreamIds(upstreamDocument))
  return excludedUpstreamIds.filter(
    (excludedUpstreamId) => !upstreamIdSet.has(excludedUpstreamId),
  )
}

const resolvedProjectTasks = resolveProjectTasks(PROJECT_TASKS)

export const PROJECT_TASKS_BY_RESET_CYCLE: ResolvedProjectTasks =
  resolvedProjectTasks
