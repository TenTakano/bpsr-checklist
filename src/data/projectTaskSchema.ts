import { z } from 'zod'
import { findDuplicateIds, TaskIdSchema } from './taskSchema'
import type { TaskCategory } from './taskLookup'

export const ProjectTaskDefinitionSchema = z.strictObject({
  id: TaskIdSchema,
  upstreamIds: z.array(TaskIdSchema),
  label: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  maxProgress: z.number().int().positive().optional(),
  optional: z.boolean().optional(),
  category: z.enum(['daily', 'weekly']).optional(),
})

export type ProjectTaskDefinition = z.infer<typeof ProjectTaskDefinitionSchema>

export type UpstreamCategoryResolver = (
  upstreamId: string,
) => TaskCategory | null

function countUpstreamIdUsages(
  definitions: ProjectTaskDefinition[],
): Map<string, number> {
  const usageCount = new Map<string, number>()
  for (const definition of definitions) {
    for (const upstreamId of definition.upstreamIds) {
      usageCount.set(upstreamId, (usageCount.get(upstreamId) ?? 0) + 1)
    }
  }
  return usageCount
}

export function createProjectTaskDefinitionsSchema(
  resolveUpstreamCategory: UpstreamCategoryResolver,
) {
  return z
    .array(ProjectTaskDefinitionSchema)
    .superRefine((definitions, ctx) => {
      const duplicateIds = findDuplicateIds(
        definitions,
        (definition) => definition.id,
      )
      if (duplicateIds.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: `id が重複しています: ${duplicateIds.join(', ')}`,
        })
      }

      for (const definition of definitions) {
        const categories = new Set(
          definition.upstreamIds
            .map(resolveUpstreamCategory)
            .filter((category): category is TaskCategory => category !== null),
        )
        if (categories.size > 1) {
          ctx.addIssue({
            code: 'custom',
            message: `プロジェクトタスク ${definition.id} の upstreamIds が daily/weekly を跨いでいます`,
          })
        }
      }

      const upstreamIdUsageCount = countUpstreamIdUsages(definitions)
      for (const definition of definitions) {
        const isSplit = definition.upstreamIds.some(
          (upstreamId) => (upstreamIdUsageCount.get(upstreamId) ?? 0) > 1,
        )
        if (isSplit && definition.maxProgress === undefined) {
          ctx.addIssue({
            code: 'custom',
            message: `プロジェクトタスク ${definition.id} は upstreamId を他のエントリと共有しているため maxProgress の明示指定が必要です`,
          })
        }
      }

      for (const definition of definitions) {
        const isProjectOnly = definition.upstreamIds.length === 0
        if (isProjectOnly) {
          const missingFields: string[] = []
          if (definition.label === undefined) missingFields.push('label')
          if (definition.color === undefined) missingFields.push('color')
          if (definition.maxProgress === undefined)
            missingFields.push('maxProgress')
          if (definition.category === undefined) missingFields.push('category')
          if (missingFields.length > 0) {
            ctx.addIssue({
              code: 'custom',
              message: `プロジェクトタスク ${definition.id} は upstreamIds が空の独自タスクのため ${missingFields.join(', ')} の明示指定が必要です`,
            })
          }
        } else if (definition.category !== undefined) {
          ctx.addIssue({
            code: 'custom',
            message: `プロジェクトタスク ${definition.id} は upstreamIds が非空のため category を指定できません`,
          })
        }
      }
    })
}
