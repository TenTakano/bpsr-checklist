import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { PROJECT_TASKS } from '../src/data/projectTasks.ts'

function main(): void {
  for (const task of PROJECT_TASKS) {
    console.log(task.id)
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMainModule) {
  main()
}
