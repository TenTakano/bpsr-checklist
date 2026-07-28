import { describe, expect, it } from 'vitest'
import {
  ExtractionError,
  extractUpstreamTasks,
  parseArgs,
} from './extract-upstream.ts'

function buildFixture(daily: string, weekly: string): string {
  return `
(() => {
  const dailyTaskData = [
${daily}
  ];

  const weeklyTaskData = [
${weekly}
  ];
})();
`
}

describe('extractUpstreamTasks', () => {
  it('extracts daily and weekly tasks correctly', () => {
    const source = buildFixture(
      `    { id: "daily_a", label: \`Daily A\`, color: "gold", maxProgress: 1, optional: false },
    { id: "daily_b", label: "Daily B", color: "grey", maxProgress: 2, optional: true },`,
      `    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 3, optional: false },`,
    )

    const result = extractUpstreamTasks(source, 'abc1234')

    expect(result).toEqual({
      schemaVersion: 1,
      upstreamCommit: 'abc1234',
      daily: [
        {
          id: 'daily_a',
          label: 'Daily A',
          color: 'gold',
          maxProgress: 1,
          optional: false,
        },
        {
          id: 'daily_b',
          label: 'Daily B',
          color: 'grey',
          maxProgress: 2,
          optional: true,
        },
      ],
      weekly: [
        {
          id: 'weekly_a',
          label: 'Weekly A',
          color: 'blue',
          maxProgress: 3,
          optional: false,
        },
      ],
    })
  })

  it('normalizes upstreamCommit to null when omitted', () => {
    const source = buildFixture(
      `    { id: "daily_a", label: "Daily A", color: "gold", maxProgress: 1, optional: false },`,
      `    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 1, optional: false },`,
    )

    const result = extractUpstreamTasks(source, null)

    expect(result.upstreamCommit).toBeNull()
  })

  it('fails when upstreamCommit does not look like a git sha', () => {
    const source = buildFixture(
      `    { id: "daily_a", label: "Daily A", color: "gold", maxProgress: 1, optional: false },`,
      `    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 1, optional: false },`,
    )

    expect(() => extractUpstreamTasks(source, '--foo')).toThrow(ExtractionError)
  })

  it('excludes commented-out elements from the result', () => {
    const source = buildFixture(
      `    { id: "daily_a", label: "Daily A", color: "gold", maxProgress: 1, optional: false },
    // { id: "daily_disabled", label: "Disabled", color: "grey", maxProgress: 1, optional: false },`,
      `    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 1, optional: false },`,
    )

    const result = extractUpstreamTasks(source, null)

    expect(result.daily).toHaveLength(1)
    expect(result.daily.map((task) => task.id)).toEqual(['daily_a'])
  })

  it('fails when an id is duplicated across daily and weekly', () => {
    const source = buildFixture(
      `    { id: "shared_id", label: "Daily", color: "gold", maxProgress: 1, optional: false },`,
      `    { id: "shared_id", label: "Weekly", color: "blue", maxProgress: 1, optional: false },`,
    )

    expect(() => extractUpstreamTasks(source, null)).toThrow(ExtractionError)
  })

  it('fails when the array is empty', () => {
    const source = buildFixture(
      '',
      `    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 1, optional: false },`,
    )

    expect(() => extractUpstreamTasks(source, null)).toThrow(ExtractionError)
  })

  it('fails when the declaration itself cannot be found', () => {
    const source = `
(() => {
  const weeklyTaskData = [
    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 1, optional: false },
  ];
})();
`

    expect(() => extractUpstreamTasks(source, null)).toThrow(ExtractionError)
  })

  it.each([
    ['a reference to an undeclared identifier', 'label: LABEL_FROM_ELSEWHERE'],
    ['a function call', 'label: buildLabel()'],
    ['a template literal with substitution', 'label: `value ${1 + 1}`'],
  ])('fails when a field contains %s', (_description, fieldSource) => {
    const source = buildFixture(
      `    { id: "daily_a", ${fieldSource}, color: "gold", maxProgress: 1, optional: false },`,
      `    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 1, optional: false },`,
    )

    expect(() => extractUpstreamTasks(source, null)).toThrow(ExtractionError)
  })

  it.each([
    ['the element is not an object literal', '"daily_a"'],
    [
      'a property uses spread syntax',
      '{ id: "daily_a", ...base, label: "Daily A", color: "gold", maxProgress: 1, optional: false }',
    ],
    [
      'a property uses shorthand syntax',
      '{ id, label: "Daily A", color: "gold", maxProgress: 1, optional: false }',
    ],
    [
      'a property uses a computed name',
      '{ ["id"]: "daily_a", label: "Daily A", color: "gold", maxProgress: 1, optional: false }',
    ],
    [
      'a property uses the forbidden key __proto__',
      '{ id: "daily_a", label: "Daily A", color: "gold", maxProgress: 1, optional: false, __proto__: "x" }',
    ],
    [
      'a property uses the forbidden key constructor',
      '{ id: "daily_a", label: "Daily A", color: "gold", maxProgress: 1, optional: false, constructor: "x" }',
    ],
    [
      'a property uses the forbidden key prototype',
      '{ id: "daily_a", label: "Daily A", color: "gold", maxProgress: 1, optional: false, prototype: "x" }',
    ],
    [
      'a field fails schema validation with a type mismatch',
      '{ id: "daily_a", label: "Daily A", color: "gold", maxProgress: 1, optional: null }',
    ],
    [
      'maxProgress fails the positive constraint',
      '{ id: "daily_a", label: "Daily A", color: "gold", maxProgress: -1, optional: false }',
    ],
    [
      'the object has an extra property',
      '{ id: "daily_a", label: "Daily A", color: "gold", maxProgress: 1, optional: false, extra: "x" }',
    ],
    [
      'the id itself is __proto__',
      '{ id: "__proto__", label: "Daily A", color: "gold", maxProgress: 1, optional: false }',
    ],
    [
      'the id itself is constructor',
      '{ id: "constructor", label: "Daily A", color: "gold", maxProgress: 1, optional: false }',
    ],
    [
      'the id itself is prototype',
      '{ id: "prototype", label: "Daily A", color: "gold", maxProgress: 1, optional: false }',
    ],
  ])('fails when %s', (_description, dailyElementSource) => {
    const source = buildFixture(
      `    ${dailyElementSource},`,
      `    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 1, optional: false },`,
    )

    expect(() => extractUpstreamTasks(source, null)).toThrow(ExtractionError)
  })
})

describe('parseArgs', () => {
  it('parses the input path and --upstream-commit', () => {
    expect(parseArgs(['script.js', '--upstream-commit', 'abc123'])).toEqual({
      inputPath: 'script.js',
      upstreamCommit: 'abc123',
    })
  })

  it('defaults upstreamCommit to null when omitted', () => {
    expect(parseArgs(['script.js'])).toEqual({
      inputPath: 'script.js',
      upstreamCommit: null,
    })
  })

  it('ignores the -- separator inserted by pnpm run', () => {
    expect(
      parseArgs(['--', 'script.js', '--upstream-commit', 'abc123']),
    ).toEqual({
      inputPath: 'script.js',
      upstreamCommit: 'abc123',
    })
  })

  it('fails when the input path is missing', () => {
    expect(() => parseArgs([])).toThrow(ExtractionError)
  })

  it('fails when --upstream-commit has no value', () => {
    expect(() => parseArgs(['script.js', '--upstream-commit'])).toThrow(
      ExtractionError,
    )
  })
})
