import { z } from 'zod'
import {
  AvailableWeekdaysSchema,
  findDuplicateIds,
  TaskIdSchema,
  type Task,
} from './taskSchema'
import { ResetCycleSchema, type ResetCycle } from './resetCycle'

export const ProjectTaskDefinitionSchema = z
  .strictObject({
    id: TaskIdSchema,
    upstreamIds: z.array(TaskIdSchema),
    label: z.string().min(1),
    color: z.string().min(1),
    maxProgress: z.number().int().positive(),
    optional: z.boolean(),
    resetCycle: ResetCycleSchema,
    availableWeekdays: AvailableWeekdaysSchema.optional(),
  })
  .superRefine((definition, ctx) => {
    if (
      definition.availableWeekdays !== undefined &&
      definition.resetCycle !== 'daily'
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `availableWeekdays は resetCycle が 'daily' のときのみ指定できます: ${definition.id}`,
      })
    }
  })

export type ProjectTaskDefinition = z.infer<typeof ProjectTaskDefinitionSchema>

// The raw shape of a single task in upstreamTasks.json. Unchanged from the
// existing 5 fields.
export type UpstreamTask = Task

// The shape of a task as the app actually consumes it, assembled by
// resolveProjectTasks. UpstreamTask plus resetCycle.
export type ProjectTask = UpstreamTask & { resetCycle: ResetCycle }

export type UpstreamResetCycleResolver = (
  upstreamId: string,
) => ResetCycle | null

export function createProjectTaskDefinitionsSchema(
  resolveUpstreamResetCycle: UpstreamResetCycleResolver,
  resetCycleOverrideIds: ReadonlySet<string> = new Set(),
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
        const resetCycles = new Set(
          definition.upstreamIds
            .map(resolveUpstreamResetCycle)
            .filter(
              (resetCycle): resetCycle is ResetCycle => resetCycle !== null,
            ),
        )
        if (resetCycles.size > 1) {
          ctx.addIssue({
            code: 'custom',
            message: `プロジェクトタスク ${definition.id} の upstreamIds が daily/weekly を跨いでいます`,
          })
        }
      }

      for (const definition of definitions) {
        if (definition.upstreamIds.length === 0) continue
        if (resetCycleOverrideIds.has(definition.id)) continue

        const resolvedResetCycles = definition.upstreamIds
          .map(resolveUpstreamResetCycle)
          .filter((resetCycle): resetCycle is ResetCycle => resetCycle !== null)
        const hasResetCycleMismatch = resolvedResetCycles.some(
          (resetCycle) => resetCycle !== definition.resetCycle,
        )
        if (hasResetCycleMismatch) {
          ctx.addIssue({
            code: 'custom',
            message: `プロジェクトタスク ${definition.id} の resetCycle (${definition.resetCycle}) が upstreamIds から解決されるリセット周期と一致しません`,
          })
        }
      }
    })
}
