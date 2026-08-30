import { z } from 'zod'
import { TaskColorTokenSchema } from './taskColors'
import { TaskCategorySchema } from './taskLookup'
import { FORBIDDEN_IDENTIFIER_KEYS } from './taskSchema'

export const MAX_CUSTOM_TASK_NAME_LENGTH = 50

export const MIN_CUSTOM_TASK_MAX_PROGRESS = 1
export const MAX_CUSTOM_TASK_MAX_PROGRESS = 1000

// UI上でユーザーが新規作成できるカスタムタスクの上限。
// store/backup.ts の MAX_IMPORT_CUSTOM_TASKS（バックアップインポート時の
// ペイロードサイズ上限）とは目的の異なる別ドメインの定数であり、値の整合は
// customTaskSchema.test.ts でテストする。
export const MAX_CUSTOM_TASKS = 200

export const CUSTOM_TASK_ID_PREFIX = 'custom_'

// 既存タスク(upstreamTasks.json由来の daily_*/weekly_* 等)の TaskIdSchema
// と名前空間が衝突しないよう、custom_ プレフィックスを必須にする。
// progress は id を単一のキーとして扱うため、衝突するとビルトインタスクと
// カスタムタスクの進捗が同一キーにエイリアスされてしまう。
export const CustomTaskIdSchema = z
  .string()
  .regex(/^custom_[a-z0-9_]+$/)
  .refine((id) => !FORBIDDEN_IDENTIFIER_KEYS.has(id), {
    message:
      'id にはプロトタイプ汚染につながる __proto__ / constructor / prototype は使用できません',
  })

export const CustomTaskSchema = z.strictObject({
  id: CustomTaskIdSchema,
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
