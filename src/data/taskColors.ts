// upstreamTasks.json's task.color contains custom tokens like pearl / dark_purple
// that are not valid CSS color keywords. A Map (rather than a plain object) is
// used so lookups cannot be diverted through inherited Object.prototype keys
// such as constructor.
const COLOR_TOKEN_MAP = new Map<string, string>([
  ['blue', 'var(--task-color-blue)'],
  ['brown', 'var(--task-color-brown)'],
  ['dark_purple', 'var(--task-color-dark-purple)'],
  ['gold', 'var(--task-color-gold)'],
  ['green', 'var(--task-color-green)'],
  ['grey', 'var(--task-color-grey)'],
  ['orange', 'var(--task-color-orange)'],
  ['pearl', 'var(--task-color-pearl)'],
  ['purple', 'var(--task-color-purple)'],
  ['yellow', 'var(--task-color-yellow)'],
])

const FALLBACK_TASK_COLOR = 'var(--task-color-neutral)'

export const resolveTaskColor = (colorToken: string): string =>
  COLOR_TOKEN_MAP.get(colorToken) ?? FALLBACK_TASK_COLOR
