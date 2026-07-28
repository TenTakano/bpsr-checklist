import { z } from 'zod'

export const FORBIDDEN_IDENTIFIER_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
])

export const TaskSchema = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z0-9_]+$/)
    .refine((id) => !FORBIDDEN_IDENTIFIER_KEYS.has(id), {
      message:
        'id にはプロトタイプ汚染につながる __proto__ / constructor / prototype は使用できません',
    }),
  label: z.string().min(1),
  color: z.string().min(1),
  maxProgress: z.number().int().positive(),
  optional: z.boolean(),
})

export type Task = z.infer<typeof TaskSchema>

function findDuplicateIds(tasks: Task[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const task of tasks) {
    if (seen.has(task.id)) {
      duplicates.add(task.id)
    }
    seen.add(task.id)
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
    const duplicates = findDuplicateIds([...document.daily, ...document.weekly])
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: 'custom',
        message: `id が daily/weekly 間で重複しています: ${duplicates.join(', ')}`,
      })
    }
  })

export type UpstreamTasksDocument = z.infer<typeof UpstreamTasksDocumentSchema>
