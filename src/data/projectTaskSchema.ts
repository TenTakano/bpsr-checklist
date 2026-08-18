import { z } from 'zod'
import { findDuplicateIds, TaskIdSchema } from './taskSchema'
import type { TaskCategory } from './taskLookup'

export const ProjectTaskDefinitionSchema = z.strictObject({
  id: TaskIdSchema,
  upstreamIds: z.array(TaskIdSchema),
  label: z.string().min(1),
  color: z.string().min(1),
  maxProgress: z.number().int().positive(),
  optional: z.boolean(),
  category: z.enum(['daily', 'weekly']),
})

export type ProjectTaskDefinition = z.infer<typeof ProjectTaskDefinitionSchema>

export type UpstreamCategoryResolver = (
  upstreamId: string,
) => TaskCategory | null

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

      for (const definition of definitions) {
        if (definition.upstreamIds.length === 0) continue

        const resolvedCategories = definition.upstreamIds
          .map(resolveUpstreamCategory)
          .filter((category): category is TaskCategory => category !== null)
        const hasCategoryMismatch = resolvedCategories.some(
          (category) => category !== definition.category,
        )
        if (hasCategoryMismatch) {
          ctx.addIssue({
            code: 'custom',
            message: `プロジェクトタスク ${definition.id} の category (${definition.category}) が upstreamIds から解決されるカテゴリと一致しません`,
          })
        }
      }
    })
}
