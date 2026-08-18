import upstreamTasksDocumentRaw from './upstreamTasks.json'
import {
  UpstreamTasksDocumentSchema,
  type Task,
  type UpstreamTasksDocument,
} from './taskSchema'
import {
  createProjectTaskDefinitionsSchema,
  type ProjectTaskDefinition,
} from './projectTaskSchema'
import type { TaskCategory } from './taskLookup'
import { PROJECT_TASKS, EXCLUDED_UPSTREAM_IDS } from './projectTasks'

export interface ResolvedProjectTasks {
  daily: Task[]
  weekly: Task[]
}

export function resolveProjectTasks(
  definitions: ProjectTaskDefinition[],
  upstreamDocument: UpstreamTasksDocument,
): ResolvedProjectTasks {
  const upstreamTaskById = new Map<string, Task>()
  const upstreamCategoryById = new Map<string, TaskCategory>()
  for (const task of upstreamDocument.daily) {
    upstreamTaskById.set(task.id, task)
    upstreamCategoryById.set(task.id, 'daily')
  }
  for (const task of upstreamDocument.weekly) {
    upstreamTaskById.set(task.id, task)
    upstreamCategoryById.set(task.id, 'weekly')
  }

  const definitionsSchema = createProjectTaskDefinitionsSchema(
    (upstreamId) => upstreamCategoryById.get(upstreamId) ?? null,
  )
  const validatedDefinitions = definitionsSchema.parse(definitions)

  const daily: Task[] = []
  const weekly: Task[] = []
  const pushByCategory = (category: TaskCategory, task: Task): void => {
    if (category === 'daily') {
      daily.push(task)
    } else {
      weekly.push(task)
    }
  }

  for (const definition of validatedDefinitions) {
    const isProjectOnly = definition.upstreamIds.length === 0

    if (isProjectOnly) {
      const { category, label, color, maxProgress } = definition
      if (
        category === undefined ||
        label === undefined ||
        color === undefined ||
        maxProgress === undefined
      ) {
        throw new Error(
          `プロジェクトタスク ${definition.id} の label/color/maxProgress/category を解決できません`,
        )
      }

      const resolvedTask: Task = {
        id: definition.id,
        label,
        color,
        maxProgress,
        optional: definition.optional ?? false,
      }

      pushByCategory(category, resolvedTask)
      continue
    }

    const upstreamTasks = definition.upstreamIds.map((upstreamId) => {
      const upstreamTask = upstreamTaskById.get(upstreamId)
      if (upstreamTask === undefined) {
        throw new Error(
          `プロジェクトタスク ${definition.id} が参照する upstreamId "${upstreamId}" が upstreamTasks.json に存在しません`,
        )
      }
      return upstreamTask
    })
    const primaryUpstreamTask = upstreamTasks[0]
    const category = upstreamCategoryById.get(definition.upstreamIds[0])
    if (category === undefined) {
      throw new Error(
        `プロジェクトタスク ${definition.id} の daily/weekly カテゴリを解決できません`,
      )
    }

    const resolvedTask: Task = {
      id: definition.id,
      label: definition.label ?? primaryUpstreamTask.label,
      color: definition.color ?? primaryUpstreamTask.color,
      maxProgress:
        definition.maxProgress ??
        upstreamTasks.reduce((sum, task) => sum + task.maxProgress, 0),
      optional: definition.optional ?? primaryUpstreamTask.optional,
    }

    pushByCategory(category, resolvedTask)
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

const upstreamTasksDocument = UpstreamTasksDocumentSchema.parse(
  upstreamTasksDocumentRaw,
)

const excludedIdsOverlappingProjectTasks =
  findExcludedIdsOverlappingProjectTasks(PROJECT_TASKS, EXCLUDED_UPSTREAM_IDS)
if (excludedIdsOverlappingProjectTasks.length > 0) {
  throw new Error(
    `EXCLUDED_UPSTREAM_IDS の以下の id が projectTasks.ts の upstreamIds と重複しています: ${excludedIdsOverlappingProjectTasks.join(', ')}`,
  )
}

const nonexistentExcludedUpstreamIds = findNonexistentExcludedUpstreamIds(
  EXCLUDED_UPSTREAM_IDS,
  upstreamTasksDocument,
)
if (nonexistentExcludedUpstreamIds.length > 0) {
  throw new Error(
    `EXCLUDED_UPSTREAM_IDS の以下の id が upstreamTasks.json に存在しません: ${nonexistentExcludedUpstreamIds.join(', ')}`,
  )
}

const unmappedUpstreamIds = findUnmappedUpstreamIds(
  PROJECT_TASKS,
  upstreamTasksDocument,
  EXCLUDED_UPSTREAM_IDS,
)
if (unmappedUpstreamIds.length > 0) {
  throw new Error(
    `upstreamTasks.json の以下の id が projectTasks.ts にマッピングされていません: ${unmappedUpstreamIds.join(', ')}`,
  )
}

const resolvedProjectTasks = resolveProjectTasks(
  PROJECT_TASKS,
  upstreamTasksDocument,
)

export const DAILY_TASKS: Task[] = resolvedProjectTasks.daily
export const WEEKLY_TASKS: Task[] = resolvedProjectTasks.weekly
