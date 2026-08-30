import { useMemo } from 'react'
import type { TaskCategory } from '../data/taskLookup'
import { MATRIX_TASK_SECTIONS } from '../data/taskSections'
import {
  getDisplayTasksByCategory,
  type DisplayTask,
} from '../domain/displayTasks'
import { summarizeCategoryProgress } from '../domain/progressSummary'
import { useStore } from '../store/context'
import type { Character } from '../store/schema'
import type { Store } from '../store/types'

export function SummaryPanel() {
  const { store } = useStore()
  const customTasks = store.customTasks
  const tasksByCategory = useMemo(
    () =>
      new Map(
        MATRIX_TASK_SECTIONS.map(
          ({ category }): [TaskCategory, DisplayTask[]] => [
            category,
            getDisplayTasksByCategory(category, customTasks),
          ],
        ),
      ),
    [customTasks],
  )

  return (
    <section aria-label="全体進捗サマリー" className="summary-panel">
      <h2 className="summary-panel-heading">全体進捗</h2>
      {MATRIX_TASK_SECTIONS.map(({ title, category }) => (
        <SummaryRow
          key={category}
          title={title}
          tasks={tasksByCategory.get(category) ?? []}
          characters={store.characters}
          progress={store.progress}
          hiddenTaskIds={store.hiddenTaskIds}
        />
      ))}
    </section>
  )
}

interface SummaryRowProps {
  title: string
  tasks: DisplayTask[]
  characters: Character[]
  progress: Store['progress']
  hiddenTaskIds: string[] | undefined
}

function SummaryRow({
  title,
  tasks,
  characters,
  progress,
  hiddenTaskIds,
}: SummaryRowProps) {
  const summary = useMemo(
    () => summarizeCategoryProgress(tasks, characters, progress, hiddenTaskIds),
    [tasks, characters, progress, hiddenTaskIds],
  )
  const characterById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  )

  // A category with zero tasks (static + custom combined) has nothing to
  // ever show (e.g. milestone before any custom task exists), so the whole
  // row is omitted rather than rendering a permanently non-functional 0/0
  // bar.
  if (tasks.length === 0) {
    return null
  }

  return (
    <div className="summary-row">
      <div className="summary-row-main">
        <span className="summary-row-label">{title}</span>
        <div
          className="summary-bar"
          role="progressbar"
          aria-label={`${title}の全体進捗`}
          aria-valuenow={summary.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="summary-bar-fill"
            style={{ width: `${summary.percent}%` }}
          />
        </div>
        <span className="summary-row-count">
          {summary.completed} / {summary.total}
        </span>
      </div>
      {summary.byCharacter.length > 0 && (
        <ul className="summary-per-character">
          {summary.byCharacter.map((entry) => {
            const character = characterById.get(entry.characterId)
            const name = character?.name ?? ''
            return (
              <li
                key={entry.characterId}
                className="summary-per-character-item"
                title={name}
              >
                <span className="summary-per-character-name">{name}</span>
                <span className="summary-per-character-count">
                  {entry.completed}/{entry.total}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
