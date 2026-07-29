import upstreamTasksDocument from '../data/upstreamTasks.json'
import { resolveTaskColor } from '../data/taskColors'
import { getTaskLabel } from '../data/taskLabel'
import type { Task } from '../data/taskSchema'
import { setProgress } from '../store/actions'
import { useStore, type StoreContextValue } from '../store/context'
import type { Character } from '../store/schema'
import type { Store } from '../store/types'
import { NO_CHARACTERS_MESSAGE } from './messages'

const DAILY_TASKS: Task[] = upstreamTasksDocument.daily
const WEEKLY_TASKS: Task[] = upstreamTasksDocument.weekly

type Dispatch = StoreContextValue['dispatch']

function classNames(base: string, modifier: string | false): string {
  return modifier ? `${base} ${modifier}` : base
}

function progressValue(
  progress: Store['progress'],
  characterId: string,
  taskId: string,
): number {
  if (!Object.hasOwn(progress, characterId)) {
    return 0
  }
  const characterProgress = progress[characterId]
  if (!Object.hasOwn(characterProgress, taskId)) {
    return 0
  }
  return characterProgress[taskId] ?? 0
}

export function MatrixView() {
  const { store, status, dispatch } = useStore()
  const isReadOnly = status === 'readonly'
  const characters = store.characters

  if (characters.length === 0) {
    return (
      <section aria-label="進捗マトリクス" className="matrix-view">
        <p className="matrix-empty">{NO_CHARACTERS_MESSAGE}</p>
      </section>
    )
  }

  return (
    <section aria-label="進捗マトリクス" className="matrix-view">
      <MatrixSection
        title="デイリー"
        tasks={DAILY_TASKS}
        characters={characters}
        progress={store.progress}
        isReadOnly={isReadOnly}
        dispatch={dispatch}
      />
      <MatrixSection
        title="ウィークリー"
        tasks={WEEKLY_TASKS}
        characters={characters}
        progress={store.progress}
        isReadOnly={isReadOnly}
        dispatch={dispatch}
      />
    </section>
  )
}

interface MatrixSectionProps {
  title: string
  tasks: Task[]
  characters: Character[]
  progress: Store['progress']
  isReadOnly: boolean
  dispatch: Dispatch
}

function MatrixSection({
  title,
  tasks,
  characters,
  progress,
  isReadOnly,
  dispatch,
}: MatrixSectionProps) {
  return (
    <div className="matrix-section">
      <h2>{title}</h2>
      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th scope="col" className="matrix-corner-cell">
                タスク
              </th>
              {characters.map((character) => (
                <th scope="col" key={character.id} title={character.name}>
                  <span className="matrix-character-name">
                    {character.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr
                key={task.id}
                className={classNames(
                  'matrix-row',
                  task.optional && 'matrix-row--optional',
                )}
              >
                <th
                  scope="row"
                  className="matrix-task-label"
                  style={{ borderLeftColor: resolveTaskColor(task.color) }}
                  title={getTaskLabel(task)}
                >
                  <span className="matrix-task-label-text">
                    {getTaskLabel(task)}
                  </span>
                  {task.optional && (
                    <span className="matrix-optional-badge">任意</span>
                  )}
                </th>
                {characters.map((character) => (
                  <MatrixCell
                    key={character.id}
                    character={character}
                    task={task}
                    value={progressValue(progress, character.id, task.id)}
                    isReadOnly={isReadOnly}
                    dispatch={dispatch}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface MatrixCellProps {
  character: Character
  task: Task
  value: number
  isReadOnly: boolean
  dispatch: Dispatch
}

function MatrixCell({
  character,
  task,
  value,
  isReadOnly,
  dispatch,
}: MatrixCellProps) {
  if (task.maxProgress === 1) {
    const isDone = value > 0
    return (
      <td className="matrix-cell">
        <button
          type="button"
          className={classNames(
            'matrix-toggle',
            isDone && 'matrix-toggle--done',
          )}
          aria-label={`${character.name} ${getTaskLabel(task)}`}
          aria-pressed={isDone}
          disabled={isReadOnly}
          onClick={() =>
            dispatch(setProgress(character.id, task.id, isDone ? 0 : 1))
          }
        >
          {isDone ? '✓' : ''}
        </button>
      </td>
    )
  }

  const isOverMax = value > task.maxProgress
  const canDecrement = !isReadOnly && value > 0
  const canIncrement = !isReadOnly && value < task.maxProgress

  return (
    <td className="matrix-cell">
      <div className="matrix-counter">
        <button
          type="button"
          className="matrix-counter-button"
          aria-label={`${character.name} ${getTaskLabel(task)} を減らす`}
          disabled={!canDecrement}
          onClick={() =>
            dispatch(setProgress(character.id, task.id, value - 1))
          }
        >
          −
        </button>
        <span
          className={classNames(
            'matrix-counter-value',
            isOverMax && 'matrix-counter-value--over',
          )}
        >
          {value}/{task.maxProgress}
        </span>
        <button
          type="button"
          className="matrix-counter-button"
          aria-label={`${character.name} ${getTaskLabel(task)} を増やす`}
          disabled={!canIncrement}
          onClick={() =>
            dispatch(setProgress(character.id, task.id, value + 1))
          }
        >
          ＋
        </button>
      </div>
    </td>
  )
}
