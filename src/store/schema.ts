import { z } from 'zod'

export const MAX_CHARACTER_NAME_LENGTH = 50

export const CharacterSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1).max(MAX_CHARACTER_NAME_LENGTH),
  createdAt: z.string().min(1),
})

export type Character = z.infer<typeof CharacterSchema>

export const ProgressValueSchema = z.number().int().min(0)

// Only the shape of characters/progress is validated here; persistence.ts
// performs the element-level rescue on top of this.
export const StoreSchema = z.looseObject({
  schemaVersion: z.number().int().min(1),
  taskDataVersion: z.string().min(1).nullable(),
  characters: z.array(z.unknown()),
  progress: z.record(z.string(), z.record(z.string(), z.unknown())),
})
