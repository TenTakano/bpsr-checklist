import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ProjectTasksValidationError,
  validateProjectTasksSource,
} from './validate-project-tasks.ts'

function buildFixture(projectTasksBody: string): string {
  return `import type { ProjectTaskDefinition } from './projectTaskSchema'

export const PROJECT_TASKS = ${projectTasksBody} satisfies ProjectTaskDefinition[]

export const EXCLUDED_UPSTREAM_IDS: string[] = []
`
}

describe('validateProjectTasksSource', () => {
  it('accepts a literals-only module with nested objects and arrays', () => {
    const source = buildFixture(`[
  { id: 'mystery_store', upstreamIds: ['daily_mystery_store'] },
  {
    id: 'guild_checkin',
    upstreamIds: ['daily_guild_checkin', 'weekly_guild_checkin'],
    label: 'Guild',
    color: 'gold',
    maxProgress: 2,
    optional: true,
  },
]`)

    expect(() => validateProjectTasksSource(source)).not.toThrow()
  })

  it('accepts the real src/data/projectTasks.ts', () => {
    const source = readFileSync(
      resolve(
        dirname(fileURLToPath(import.meta.url)),
        '../src/data/projectTasks.ts',
      ),
      'utf-8',
    )

    expect(() => validateProjectTasksSource(source)).not.toThrow()
  })

  it('fails when a value import is added', () => {
    const source = `import { execSync } from 'node:child_process'
import type { ProjectTaskDefinition } from './projectTaskSchema'

export const PROJECT_TASKS = [] satisfies ProjectTaskDefinition[]
export const EXCLUDED_UPSTREAM_IDS: string[] = []
`

    expect(() => validateProjectTasksSource(source)).toThrow(
      ProjectTasksValidationError,
    )
  })

  it('fails when a top-level expression statement is added', () => {
    const source = `import type { ProjectTaskDefinition } from './projectTaskSchema'

console.log('hi')

export const PROJECT_TASKS = [] satisfies ProjectTaskDefinition[]
export const EXCLUDED_UPSTREAM_IDS: string[] = []
`

    expect(() => validateProjectTasksSource(source)).toThrow(
      ProjectTasksValidationError,
    )
  })

  it('fails when a top-level function declaration is added', () => {
    const source = `import type { ProjectTaskDefinition } from './projectTaskSchema'

function helper() {
  return 1
}

export const PROJECT_TASKS = [] satisfies ProjectTaskDefinition[]
export const EXCLUDED_UPSTREAM_IDS: string[] = []
`

    expect(() => validateProjectTasksSource(source)).toThrow(
      ProjectTasksValidationError,
    )
  })

  it('fails when an extra export is added', () => {
    const source = `import type { ProjectTaskDefinition } from './projectTaskSchema'

export const PROJECT_TASKS = [] satisfies ProjectTaskDefinition[]
export const EXCLUDED_UPSTREAM_IDS: string[] = []
export const EXTRA = 'x'
`

    expect(() => validateProjectTasksSource(source)).toThrow(
      ProjectTasksValidationError,
    )
  })

  it('fails when a required export is missing', () => {
    const source = `import type { ProjectTaskDefinition } from './projectTaskSchema'

export const PROJECT_TASKS = [] satisfies ProjectTaskDefinition[]
`

    expect(() => validateProjectTasksSource(source)).toThrow(
      ProjectTasksValidationError,
    )
  })

  it.each([
    ['a function call', `[buildTask()]`],
    ['a template literal', '[`daily_a`]'],
    ['an identifier reference', `[SOME_CONST]`],
    ['an as expression', `[] as string[]`],
  ])(
    'fails when the PROJECT_TASKS initializer contains %s',
    (_description, arrayBody) => {
      const source = buildFixture(arrayBody)

      expect(() => validateProjectTasksSource(source)).toThrow(
        ProjectTasksValidationError,
      )
    },
  )

  it('fails when an object property uses a computed key', () => {
    const source = buildFixture(`[
  { ['id']: 'mystery_store', upstreamIds: ['daily_mystery_store'] },
]`)

    expect(() => validateProjectTasksSource(source)).toThrow(
      ProjectTasksValidationError,
    )
  })

  it('fails when an object property uses spread syntax', () => {
    const source = buildFixture(`[
  { ...base, id: 'mystery_store', upstreamIds: ['daily_mystery_store'] },
]`)

    expect(() => validateProjectTasksSource(source)).toThrow(
      ProjectTasksValidationError,
    )
  })

  it('fails when an object property uses shorthand syntax', () => {
    const source = buildFixture(`[
  { id, upstreamIds: ['daily_mystery_store'] },
]`)

    expect(() => validateProjectTasksSource(source)).toThrow(
      ProjectTasksValidationError,
    )
  })
})
