import { z } from 'zod'
import { TaskColorTokenSchema } from './taskColors'
import { TaskCategorySchema } from './taskLookup'
import { TaskIdSchema } from './taskSchema'

export const MAX_CUSTOM_TASK_NAME_LENGTH = 50

export const MIN_CUSTOM_TASK_MAX_PROGRESS = 1
export const MAX_CUSTOM_TASK_MAX_PROGRESS = 1000

export const CustomTaskSchema = z.strictObject({
  id: TaskIdSchema,
  name: z.string().min(1).max(MAX_CUSTOM_TASK_NAME_LENGTH),
  color: TaskColorTokenSchema,
  maxProgress: z
    .number()
    .int()
    .min(MIN_CUSTOM_TASK_MAX_PROGRESS)
    .max(MAX_CUSTOM_TASK_MAX_PROGRESS),
  category: TaskCategorySchema,
})

export type CustomTask = z.infer<typeof CustomTaskSchema>
