import { z } from 'zod'
import { findDuplicateIds, TaskIdSchema } from './taskSchema'
import type { TaskCategory } from './taskLookup'

export const ProjectTaskDefinitionSchema = z.strictObject({
  id: TaskIdSchema,
  upstreamIds: z.array(TaskIdSchema).min(1),
  label: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  maxProgress: z.number().int().positive().optional(),
  optional: z.boolean().optional(),
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
    })
}
