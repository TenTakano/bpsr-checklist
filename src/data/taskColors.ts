import { z } from 'zod'

export const TASK_COLOR_TOKENS = [
  'blue',
  'brown',
  'dark_purple',
  'gold',
  'green',
  'grey',
  'orange',
  'pearl',
  'purple',
  'yellow',
] as const

export const TaskColorTokenSchema = z.enum(TASK_COLOR_TOKENS)

export type TaskColorToken = z.infer<typeof TaskColorTokenSchema>

// upstreamTasks.json's task.color contains custom tokens like pearl / dark_purple
// that are not valid CSS color keywords. A Map (rather than a plain object) is
// used so lookups cannot be diverted through inherited Object.prototype keys
// such as constructor.
const COLOR_TOKEN_MAP = new Map<string, string>(
  TASK_COLOR_TOKENS.map((token) => [
    token,
    `var(--task-color-${token.replace(/_/g, '-')})`,
  ]),
)

const FALLBACK_TASK_COLOR = 'var(--task-color-neutral)'

export const resolveTaskColor = (colorToken: string): string =>
  COLOR_TOKEN_MAP.get(colorToken) ?? FALLBACK_TASK_COLOR
