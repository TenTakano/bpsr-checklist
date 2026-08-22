import { z } from 'zod'

export const RESET_CYCLES = ['daily', 'weekly'] as const

export const ResetCycleSchema = z.enum(RESET_CYCLES)

export type ResetCycle = z.infer<typeof ResetCycleSchema>
