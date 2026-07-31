import { z } from 'zod'

export const MAX_CHARACTER_NAME_LENGTH = 50

export const CharacterSchema = z.strictObject({
  id: z.string().min(1),
  name: z.string().min(1).max(MAX_CHARACTER_NAME_LENGTH),
  createdAt: z.string().min(1),
})

export type Character = z.infer<typeof CharacterSchema>

export const ProgressValueSchema = z.number().int().min(0)

const IsoDateTimeStringSchema = z.iso.datetime()

export const ResetStateSchema = z.strictObject({
  dailyPeriodStart: IsoDateTimeStringSchema,
  weeklyPeriodStart: IsoDateTimeStringSchema,
})

export type ResetState = z.infer<typeof ResetStateSchema>

// resetState is left as z.unknown().optional() rather than ResetStateSchema
// so an invalid value degrades to "absent" (see rescueResetState in
// persistence.ts) instead of failing the whole top-level parse.
export const StoreSchema = z.looseObject({
  schemaVersion: z.number().int().min(1),
  taskDataVersion: z.string().min(1).nullable(),
  characters: z.array(z.unknown()),
  progress: z.record(z.string(), z.record(z.string(), z.unknown())),
  resetState: z.unknown().optional(),
})
