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
import { PROJECT_TASKS } from './projectTasks'

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

  for (const definition of validatedDefinitions) {
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

    if (category === 'daily') {
      daily.push(resolvedTask)
    } else {
      weekly.push(resolvedTask)
    }
  }

  return { daily, weekly }
}

export function findUnmappedUpstreamIds(
  definitions: ProjectTaskDefinition[],
  upstreamDocument: UpstreamTasksDocument,
): string[] {
  const referencedUpstreamIds = new Set(
    definitions.flatMap((definition) => definition.upstreamIds),
  )
  return [...upstreamDocument.daily, ...upstreamDocument.weekly]
    .map((task) => task.id)
    .filter((upstreamId) => !referencedUpstreamIds.has(upstreamId))
}

const upstreamTasksDocument = UpstreamTasksDocumentSchema.parse(
  upstreamTasksDocumentRaw,
)

const unmappedUpstreamIds = findUnmappedUpstreamIds(
  PROJECT_TASKS,
  upstreamTasksDocument,
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
