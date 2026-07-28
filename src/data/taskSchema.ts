import { z } from 'zod'

export const TaskSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  color: z.string().min(1),
  maxProgress: z.number().int().positive(),
  optional: z.boolean(),
})

export type Task = z.infer<typeof TaskSchema>

const findDuplicateIds = (tasks: Task[]): string[] => {
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
    upstreamCommit: z.string().min(1).nullable(),
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
