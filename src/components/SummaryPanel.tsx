import { useMemo } from 'react'
import { getCurrentWeekdayJst } from '../data/resetConfig'
import { PROJECT_TASKS_BY_RESET_CYCLE } from '../data/projectTasksResolver'
import type { ProjectTask } from '../data/projectTaskSchema'
import { TASK_SECTIONS } from '../data/taskSections'
import { summarizeCategoryProgress } from '../domain/progressSummary'
import { getExcludedTaskIds } from '../domain/taskAvailability'
import { useStore } from '../store/context'
import type { Character } from '../store/schema'
import type { Store } from '../store/types'

export function SummaryPanel() {
  const { store } = useStore()
  const currentWeekdayJst = getCurrentWeekdayJst(store.resetState?.daily)

  return (
    <section aria-label="全体進捗サマリー" className="summary-panel">
      <h2 className="summary-panel-heading">全体進捗</h2>
      {TASK_SECTIONS.map(({ title, cycle }) => (
        <SummaryRow
          key={cycle}
          title={title}
          tasks={PROJECT_TASKS_BY_RESET_CYCLE[cycle]}
          characters={store.characters}
          progress={store.progress}
          hiddenTaskIds={store.hiddenTaskIds}
          currentWeekdayJst={currentWeekdayJst}
        />
      ))}
    </section>
  )
}

interface SummaryRowProps {
  title: string
  tasks: ProjectTask[]
  characters: Character[]
  progress: Store['progress']
  hiddenTaskIds: string[] | undefined
  currentWeekdayJst: number | undefined
}

function SummaryRow({
  title,
  tasks,
  characters,
  progress,
  hiddenTaskIds,
  currentWeekdayJst,
}: SummaryRowProps) {
  const excludedTaskIds = useMemo(
    () => getExcludedTaskIds(tasks, hiddenTaskIds, currentWeekdayJst),
    [tasks, hiddenTaskIds, currentWeekdayJst],
  )
  const summary = useMemo(
    () =>
      summarizeCategoryProgress(tasks, characters, progress, excludedTaskIds),
    [tasks, characters, progress, excludedTaskIds],
  )
  const characterById = useMemo(
    () => new Map(characters.map((character) => [character.id, character])),
    [characters],
  )

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
