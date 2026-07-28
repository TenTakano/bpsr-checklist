import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import {
  TaskSchema,
  UpstreamTasksDocumentSchema,
  type Task,
  type UpstreamTasksDocument,
} from '../src/data/taskSchema.ts'

export class ExtractionError extends Error {}

const TASK_DECLARATION_NAMES = {
  daily: 'dailyTaskData',
  weekly: 'weeklyTaskData',
} as const

type Section = keyof typeof TASK_DECLARATION_NAMES

type LiteralValue = string | number | boolean | null

function evaluateLiteral(node: ts.Expression): LiteralValue {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }
  if (ts.isNumericLiteral(node)) {
    return Number(node.text)
  }
  if (node.kind === ts.SyntaxKind.TrueKeyword) {
    return true
  }
  if (node.kind === ts.SyntaxKind.FalseKeyword) {
    return false
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) {
    return null
  }
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text)
  }
  throw new ExtractionError(
    `未対応のノード種別です (${ts.SyntaxKind[node.kind]}): ${node.getText()}`,
  )
}

export function evaluateLiteralExpression(
  expressionSource: string,
): LiteralValue {
  const sourceFile = ts.createSourceFile(
    'literal-fixture.ts',
    `const value = ${expressionSource}`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const [statement] = sourceFile.statements
  if (!statement || !ts.isVariableStatement(statement)) {
    throw new ExtractionError(`式を解析できませんでした: ${expressionSource}`)
  }
  const [declaration] = statement.declarationList.declarations
  if (!declaration?.initializer) {
    throw new ExtractionError(`式を解析できませんでした: ${expressionSource}`)
  }
  return evaluateLiteral(declaration.initializer)
}

function evaluateObjectLiteral(
  node: ts.Expression,
): Record<string, LiteralValue> {
  if (!ts.isObjectLiteralExpression(node)) {
    throw new ExtractionError(
      `オブジェクトリテラルではありません (${ts.SyntaxKind[node.kind]}): ${node.getText()}`,
    )
  }
  const result: Record<string, LiteralValue> = {}
  for (const property of node.properties) {
    if (!ts.isPropertyAssignment(property)) {
      throw new ExtractionError(
        `未対応のプロパティ形式です: ${property.getText()}`,
      )
    }
    const name = property.name
    const key =
      ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined
    if (key === undefined) {
      throw new ExtractionError(`未対応のプロパティ名です: ${name.getText()}`)
    }
    result[key] = evaluateLiteral(property.initializer)
  }
  return result
}

function findTaskArrayLiteral(
  sourceFile: ts.SourceFile,
  declarationName: string,
): ts.ArrayLiteralExpression {
  let found: ts.ArrayLiteralExpression | undefined

  const visit = (node: ts.Node): void => {
    if (found) return
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === declarationName &&
      node.initializer &&
      ts.isArrayLiteralExpression(node.initializer)
    ) {
      found = node.initializer
      return
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  if (!found) {
    throw new ExtractionError(`宣言が見つかりません: ${declarationName}`)
  }
  return found
}

function extractTaskList(sourceFile: ts.SourceFile, section: Section): Task[] {
  const declarationName = TASK_DECLARATION_NAMES[section]
  const arrayLiteral = findTaskArrayLiteral(sourceFile, declarationName)

  return arrayLiteral.elements.map((element, index) => {
    if (!ts.isObjectLiteralExpression(element)) {
      throw new ExtractionError(
        `${declarationName}[${index}] がオブジェクトリテラルではありません (${ts.SyntaxKind[element.kind]})`,
      )
    }
    const raw = evaluateObjectLiteral(element)
    const parsed = TaskSchema.safeParse(raw)
    if (!parsed.success) {
      throw new ExtractionError(
        `${declarationName}[${index}] のスキーマ検証に失敗しました: ${parsed.error.message}`,
      )
    }
    return parsed.data
  })
}

export function extractUpstreamTasks(
  sourceText: string,
  upstreamCommit: string | null,
): UpstreamTasksDocument {
  const sourceFile = ts.createSourceFile(
    'script.js',
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  )

  const daily = extractTaskList(sourceFile, 'daily')
  const weekly = extractTaskList(sourceFile, 'weekly')

  const document = {
    schemaVersion: 1 as const,
    upstreamCommit,
    daily,
    weekly,
  }

  const parsed = UpstreamTasksDocumentSchema.safeParse(document)
  if (!parsed.success) {
    throw new ExtractionError(
      `正規化データの検証に失敗しました: ${parsed.error.message}`,
    )
  }
  return parsed.data
}

interface CliArgs {
  inputPath: string
  upstreamCommit: string | null
}

export function parseArgs(argv: string[]): CliArgs {
  const positional: string[] = []
  let upstreamCommit: string | null = null

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--') {
      continue
    }
    if (arg === '--upstream-commit') {
      const value = argv[i + 1]
      if (value === undefined) {
        throw new ExtractionError('--upstream-commit には値を指定してください')
      }
      upstreamCommit = value
      i++
      continue
    }
    positional.push(arg)
  }

  const inputPath = positional[0]
  if (!inputPath) {
    throw new ExtractionError(
      'upstream script.js のローカルパスを第一引数で指定してください',
    )
  }

  return { inputPath, upstreamCommit }
}

function main(): void {
  const { inputPath, upstreamCommit } = parseArgs(process.argv.slice(2))
  const sourceText = readFileSync(resolve(inputPath), 'utf-8')
  const document = extractUpstreamTasks(sourceText, upstreamCommit)

  const outputPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../src/data/upstreamTasks.json',
  )
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`)

  console.error(
    `書き出しました: ${outputPath} (daily: ${document.daily.length}, weekly: ${document.weekly.length})`,
  )
}

const isMainModule =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  try {
    main()
  } catch (error) {
    if (error instanceof ExtractionError) {
      console.error(`抽出に失敗しました: ${error.message}`)
      process.exit(1)
    }
    throw error
  }
}
