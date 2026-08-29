import { z } from 'zod'

export const FORBIDDEN_IDENTIFIER_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
])

export const TaskIdSchema = z
  .string()
  .regex(/^[a-z0-9_]+$/)
  .refine((id) => !FORBIDDEN_IDENTIFIER_KEYS.has(id), {
    message:
      'id にはプロトタイプ汚染につながる __proto__ / constructor / prototype は使用できません',
  })

export function findDuplicateIds<T>(
  items: T[],
  getId: (item: T) => string,
): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const item of items) {
    const id = getId(item)
    if (seen.has(id)) {
      duplicates.add(id)
    }
    seen.add(id)
  }
  return [...duplicates]
}

export const AvailableWeekdaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .superRefine((weekdays, ctx) => {
    const duplicates = findDuplicateIds(weekdays, (weekday) => String(weekday))
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: `availableWeekdays に重複した曜日番号があります: ${duplicates.join(', ')}`,
      })
    }
  })

export const TaskSchema = z.strictObject({
  id: TaskIdSchema,
  label: z.string().min(1),
  color: z.string().min(1),
  maxProgress: z.number().int().positive(),
  optional: z.boolean(),
  availableWeekdays: AvailableWeekdaysSchema.optional(),
})

export type Task = z.infer<typeof TaskSchema>

export const UpstreamTasksDocumentSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    upstreamCommit: z
      .string()
      .regex(/^[0-9a-f]{7,40}$/)
      .nullable(),
    daily: z.array(TaskSchema).min(1),
    weekly: z.array(TaskSchema).min(1),
  })
  .superRefine((document, ctx) => {
    const duplicates = findDuplicateIds(
      [...document.daily, ...document.weekly],
      (task) => task.id,
    )
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: `id が daily/weekly 間で重複しています: ${duplicates.join(', ')}`,
      })
    }

    for (const task of document.weekly) {
      if (task.availableWeekdays !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `availableWeekdays は daily のときのみ指定できます: ${task.id}`,
        })
      }
    }
  })

export type UpstreamTasksDocument = z.infer<typeof UpstreamTasksDocumentSchema>
