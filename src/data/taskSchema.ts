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

export const TaskSchema = z.strictObject({
  id: TaskIdSchema,
  label: z.string().min(1),
  color: z.string().min(1),
  maxProgress: z.number().int().positive(),
  optional: z.boolean(),
})

export type Task = z.infer<typeof TaskSchema>

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
  })

export type UpstreamTasksDocument = z.infer<typeof UpstreamTasksDocumentSchema>
