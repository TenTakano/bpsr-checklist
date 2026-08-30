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

// Screen-reader label for each fixed color token, used on the custom task
// color swatch buttons. Kept independent of labels.ja.json, which maps task
// ids to task names rather than colors to Japanese names.
export const TASK_COLOR_LABELS_JA: Record<TaskColorToken, string> = {
  blue: '青',
  brown: '茶',
  dark_purple: '濃紫',
  gold: '金',
  green: '緑',
  grey: '灰',
  orange: '橙',
  pearl: '真珠',
  purple: '紫',
  yellow: '黄',
}
