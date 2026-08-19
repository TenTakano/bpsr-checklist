import type { Task, UpstreamTasksDocument } from './taskSchema'
import {
  createProjectTaskDefinitionsSchema,
  type ProjectTaskDefinition,
} from './projectTaskSchema'
import type { TaskCategory } from './taskLookup'
import { PROJECT_TASKS } from './projectTasks'

export interface ResolvedProjectTasks {
  daily: Task[]
  weekly: Task[]
}

function validateUpstreamIdsExist(
  definitions: ProjectTaskDefinition[],
  upstreamCategoryById: Map<string, TaskCategory>,
): void {
  for (const definition of definitions) {
    for (const upstreamId of definition.upstreamIds) {
      if (!upstreamCategoryById.has(upstreamId)) {
        throw new Error(
          `プロジェクトタスク ${definition.id} が参照する upstreamId "${upstreamId}" が upstreamTasks.json に存在しません`,
        )
      }
    }
  }
}

function buildUpstreamCategoryById(
  upstreamDocument: UpstreamTasksDocument,
): Map<string, TaskCategory> {
  const upstreamCategoryById = new Map<string, TaskCategory>()
  for (const task of upstreamDocument.daily) {
    upstreamCategoryById.set(task.id, 'daily')
  }
  for (const task of upstreamDocument.weekly) {
    upstreamCategoryById.set(task.id, 'weekly')
  }
  return upstreamCategoryById
}

export function validateProjectTaskDefinitions(
  definitions: ProjectTaskDefinition[],
  upstreamDocument: UpstreamTasksDocument,
): void {
  const upstreamCategoryById = buildUpstreamCategoryById(upstreamDocument)

  validateUpstreamIdsExist(definitions, upstreamCategoryById)

  const definitionsSchema = createProjectTaskDefinitionsSchema(
    (upstreamId) => upstreamCategoryById.get(upstreamId) ?? null,
  )
  definitionsSchema.parse(definitions)
}

export function resolveProjectTasks(
  definitions: ProjectTaskDefinition[],
): ResolvedProjectTasks {
  const daily: Task[] = []
  const weekly: Task[] = []
  const pushByCategory = (category: TaskCategory, task: Task): void => {
    if (category === 'daily') {
      daily.push(task)
    } else {
      weekly.push(task)
    }
  }

  for (const definition of definitions) {
    const task: Task = {
      id: definition.id,
      label: definition.label,
      color: definition.color,
      maxProgress: definition.maxProgress,
      optional: definition.optional,
    }
    pushByCategory(definition.category, task)
  }

  return { daily, weekly }
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

export const DAILY_TASKS: Task[] = resolvedProjectTasks.daily
export const WEEKLY_TASKS: Task[] = resolvedProjectTasks.weekly
