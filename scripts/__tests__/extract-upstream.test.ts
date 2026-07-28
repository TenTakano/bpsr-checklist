import { describe, expect, it } from 'vitest'
import {
  ExtractionError,
  evaluateLiteralExpression,
  extractUpstreamTasks,
  parseArgs,
} from '../extract-upstream.ts'

const buildFixture = (daily: string, weekly: string): string => `
(() => {
  const dailyTaskData = [
${daily}
  ];

  const weeklyTaskData = [
${weekly}
  ];
})();
`

describe('extractUpstreamTasks', () => {
  it('正常系: daily/weekly タスクを正しく抽出できる', () => {
    const source = buildFixture(
      `    { id: "daily_a", label: "Daily A", color: "gold", maxProgress: 1, optional: false },
    { id: "daily_b", label: "Daily B", color: "grey", maxProgress: 2, optional: true },`,
      `    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 3, optional: false },`,
    )

    const result = extractUpstreamTasks(source, 'abc123')

    expect(result).toEqual({
      schemaVersion: 1,
      upstreamCommit: 'abc123',
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

  it('upstreamCommit 省略時（null 指定）は null になる', () => {
    const source = buildFixture(
      `    { id: "daily_a", label: "Daily A", color: "gold", maxProgress: 1, optional: false },`,
      `    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 1, optional: false },`,
    )

    const result = extractUpstreamTasks(source, null)

    expect(result.upstreamCommit).toBeNull()
  })

  it('コメントアウトされた要素は結果に含まれない', () => {
    const source = buildFixture(
      `    { id: "daily_a", label: "Daily A", color: "gold", maxProgress: 1, optional: false },
    // { id: "daily_disabled", label: "Disabled", color: "grey", maxProgress: 1, optional: false },`,
      `    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 1, optional: false },`,
    )

    const result = extractUpstreamTasks(source, null)

    expect(result.daily).toHaveLength(1)
    expect(result.daily.map((task) => task.id)).toEqual(['daily_a'])
  })

  it('daily/weekly 横断で id が重複する場合は失敗する', () => {
    const source = buildFixture(
      `    { id: "shared_id", label: "Daily", color: "gold", maxProgress: 1, optional: false },`,
      `    { id: "shared_id", label: "Weekly", color: "blue", maxProgress: 1, optional: false },`,
    )

    expect(() => extractUpstreamTasks(source, null)).toThrow(ExtractionError)
  })

  it('未対応のノード種別（識別子参照）を含む要素は失敗する', () => {
    const source = buildFixture(
      `    { id: "daily_a", label: LABEL_FROM_ELSEWHERE, color: "gold", maxProgress: 1, optional: false },`,
      `    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 1, optional: false },`,
    )

    expect(() => extractUpstreamTasks(source, null)).toThrow(ExtractionError)
  })

  it('未対応のノード種別（関数呼び出し）を含む要素は失敗する', () => {
    const source = buildFixture(
      `    { id: "daily_a", label: buildLabel(), color: "gold", maxProgress: 1, optional: false },`,
      `    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 1, optional: false },`,
    )

    expect(() => extractUpstreamTasks(source, null)).toThrow(ExtractionError)
  })

  it('空配列は失敗する', () => {
    const source = buildFixture(
      '',
      `    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 1, optional: false },`,
    )

    expect(() => extractUpstreamTasks(source, null)).toThrow(ExtractionError)
  })

  it('宣言自体が見つからない場合は失敗する', () => {
    const source = `
(() => {
  const weeklyTaskData = [
    { id: "weekly_a", label: "Weekly A", color: "blue", maxProgress: 1, optional: false },
  ];
})();
`

    expect(() => extractUpstreamTasks(source, null)).toThrow(ExtractionError)
  })
})

describe('parseArgs', () => {
  it('パスと --upstream-commit を解釈できる', () => {
    expect(parseArgs(['script.js', '--upstream-commit', 'abc123'])).toEqual({
      inputPath: 'script.js',
      upstreamCommit: 'abc123',
    })
  })

  it('--upstream-commit 省略時は null になる', () => {
    expect(parseArgs(['script.js'])).toEqual({
      inputPath: 'script.js',
      upstreamCommit: null,
    })
  })

  it('pnpm run が付与する区切りの -- を無視する', () => {
    expect(
      parseArgs(['--', 'script.js', '--upstream-commit', 'abc123']),
    ).toEqual({
      inputPath: 'script.js',
      upstreamCommit: 'abc123',
    })
  })

  it('パス未指定は失敗する', () => {
    expect(() => parseArgs([])).toThrow(ExtractionError)
  })

  it('--upstream-commit に値が無い場合は失敗する', () => {
    expect(() => parseArgs(['script.js', '--upstream-commit'])).toThrow(
      ExtractionError,
    )
  })
})

describe('evaluateLiteralExpression', () => {
  it('true / false を評価できる', () => {
    expect(evaluateLiteralExpression('true')).toBe(true)
    expect(evaluateLiteralExpression('false')).toBe(false)
  })

  it('null を評価できる', () => {
    expect(evaluateLiteralExpression('null')).toBeNull()
  })

  it('負数を評価できる', () => {
    expect(evaluateLiteralExpression('-5')).toBe(-5)
  })

  it('数値リテラルを評価できる', () => {
    expect(evaluateLiteralExpression('42')).toBe(42)
  })

  it('文字列リテラルを評価できる', () => {
    expect(evaluateLiteralExpression('"hello"')).toBe('hello')
  })

  it('テンプレートリテラル（式展開なし）を評価できる', () => {
    expect(evaluateLiteralExpression('`plain text`')).toBe('plain text')
  })

  it('テンプレートリテラルの式展開は未対応として拒否する', () => {
    expect(() => evaluateLiteralExpression('`value ${1 + 1}`')).toThrow(
      ExtractionError,
    )
  })

  it('識別子参照は未対応として拒否する', () => {
    expect(() => evaluateLiteralExpression('someIdentifier')).toThrow(
      ExtractionError,
    )
  })

  it('関数呼び出しは未対応として拒否する', () => {
    expect(() => evaluateLiteralExpression('buildLabel()')).toThrow(
      ExtractionError,
    )
  })
})
