import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// This validator follows the same static-AST-only philosophy as
// scripts/extract-upstream.ts: it never executes the source file, only
// inspects its AST, and rejects any node shape it doesn't explicitly
// recognize. Unlike extract-upstream.ts (which extracts flat literal task
// records from upstream's script.js), this script validates that
// src/data/projectTasks.ts as a whole stays a "definitions only" module: no
// value imports, no functions, no expressions beyond nested
// array/object/string/number/boolean literals. This is a security boundary:
// unlike the JSON data files (which are content-validated by the workflow
// instead), projectTasks.ts is executed as part of the app, so an
// LLM-driven upstream sync must not be able to write arbitrary code into it.

export class ProjectTasksValidationError extends Error {}

const REQUIRED_EXPORT_NAMES = new Set([
  'PROJECT_TASKS',
  'EXCLUDED_UPSTREAM_IDS',
  'RESET_CYCLE_OVERRIDE_IDS',
])

function hasExportModifier(node: ts.HasModifiers): boolean {
  return (
    ts
      .getModifiers(node)
      ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
    false
  )
}

function validateLiteralExpression(node: ts.Expression): void {
  if (ts.isArrayLiteralExpression(node)) {
    for (const element of node.elements) {
      validateLiteralExpression(element)
    }
    return
  }

  if (ts.isObjectLiteralExpression(node)) {
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) {
        throw new ProjectTasksValidationError(
          `未対応のプロパティ形式です: ${property.getText()}`,
        )
      }
      const name = property.name
      if (
        !ts.isIdentifier(name) &&
        !ts.isStringLiteral(name) &&
        !ts.isNumericLiteral(name)
      ) {
        throw new ProjectTasksValidationError(
          `未対応のプロパティ名です: ${name.getText()}`,
        )
      }
      validateLiteralExpression(property.initializer)
    }
    return
  }

  if (
    ts.isStringLiteral(node) ||
    ts.isNumericLiteral(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return
  }

  throw new ProjectTasksValidationError(
    `未対応のノード種別です (${ts.SyntaxKind[node.kind]}): ${node.getText()}`,
  )
}

function validateExportInitializer(node: ts.Expression): void {
  if (ts.isSatisfiesExpression(node)) {
    validateExportInitializer(node.expression)
    return
  }
  validateLiteralExpression(node)
}

function validateImportDeclaration(node: ts.ImportDeclaration): void {
  if (!node.importClause?.isTypeOnly) {
    throw new ProjectTasksValidationError(
      `値のインポートは使用できません: ${node.getText()}`,
    )
  }
}

function validateVariableStatement(
  node: ts.VariableStatement,
  seenNames: Set<string>,
): void {
  if (!hasExportModifier(node)) {
    throw new ProjectTasksValidationError(
      `export されていない変数宣言です: ${node.getText()}`,
    )
  }

  for (const declaration of node.declarationList.declarations) {
    if (!ts.isIdentifier(declaration.name)) {
      throw new ProjectTasksValidationError(
        `未対応の宣言形式です: ${declaration.getText()}`,
      )
    }
    const name = declaration.name.text
    if (!REQUIRED_EXPORT_NAMES.has(name)) {
      throw new ProjectTasksValidationError(`想定外の export です: ${name}`)
    }
    if (seenNames.has(name)) {
      throw new ProjectTasksValidationError(`export が重複しています: ${name}`)
    }
    seenNames.add(name)

    if (!declaration.initializer) {
      throw new ProjectTasksValidationError(`初期化子がありません: ${name}`)
    }
    validateExportInitializer(declaration.initializer)
  }
}

export function validateProjectTasksSource(sourceText: string): void {
  const sourceFile = ts.createSourceFile(
    'projectTasks.ts',
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )

  const seenNames = new Set<string>()

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      validateImportDeclaration(statement)
      continue
    }
    if (ts.isVariableStatement(statement)) {
      validateVariableStatement(statement, seenNames)
      continue
    }
    throw new ProjectTasksValidationError(
      `未対応のトップレベル文です (${ts.SyntaxKind[statement.kind]}): ${statement.getText()}`,
    )
  }

  for (const requiredName of REQUIRED_EXPORT_NAMES) {
    if (!seenNames.has(requiredName)) {
      throw new ProjectTasksValidationError(
        `必須の export が見つかりません: ${requiredName}`,
      )
    }
  }
}

function main(): void {
  const inputPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../src/data/projectTasks.ts',
  )
  const sourceText = readFileSync(inputPath, 'utf-8')
  validateProjectTasksSource(sourceText)
  console.error(`検証に成功しました: ${inputPath}`)
}

const isMainModule =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  try {
    main()
  } catch (error) {
    if (error instanceof ProjectTasksValidationError) {
      console.error(
        `projectTasks.ts の構造検証に失敗しました（プロンプトインジェクション等の疑い）: ${error.message}`,
      )
      process.exit(1)
    }
    throw error
  }
}
