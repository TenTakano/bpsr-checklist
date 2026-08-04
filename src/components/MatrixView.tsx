import { useMemo, useState, type DragEvent } from 'react'
import upstreamTasksDocument from '../data/upstreamTasks.json'
import { resolveTaskColor } from '../data/taskColors'
import { getTaskLabel, splitTaskLabel } from '../data/taskLabel'
import type { TaskCategory } from '../data/taskLookup'
import { resolveTaskOrder } from '../data/taskOrder'
import type { Task } from '../data/taskSchema'
import { isTaskComplete } from '../domain/taskProgress'
import { moveTask, setProgress } from '../store/actions'
import { useStore, type StoreContextValue } from '../store/context'
import type { Character } from '../store/schema'
import type { Store } from '../store/types'
import { NO_CHARACTERS_MESSAGE, NO_VISIBLE_TASKS_MESSAGE } from './messages'

const DAILY_TASKS: Task[] = upstreamTasksDocument.daily
const WEEKLY_TASKS: Task[] = upstreamTasksDocument.weekly

type Dispatch = StoreContextValue['dispatch']
type DragOverDirection = 'above' | 'below' | null

function classNames(
  base: string,
  ...modifiers: (string | false | null | undefined)[]
): string {
  return [base, ...modifiers.filter(Boolean)].join(' ')
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
        section="daily"
        tasks={DAILY_TASKS}
        taskOrder={store.taskOrder?.daily}
        hiddenTaskIds={store.hiddenTaskIds}
        detailedCountTaskIds={store.detailedCountTaskIds}
        characters={characters}
        progress={store.progress}
        isReadOnly={isReadOnly}
        dispatch={dispatch}
      />
      <MatrixSection
        title="ウィークリー"
        section="weekly"
        tasks={WEEKLY_TASKS}
        taskOrder={store.taskOrder?.weekly}
        hiddenTaskIds={store.hiddenTaskIds}
        detailedCountTaskIds={store.detailedCountTaskIds}
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
  section: TaskCategory
  tasks: Task[]
  taskOrder: string[] | undefined
  hiddenTaskIds: string[] | undefined
  detailedCountTaskIds: string[] | undefined
  characters: Character[]
  progress: Store['progress']
  isReadOnly: boolean
  dispatch: Dispatch
}

function MatrixSection({
  title,
  section,
  tasks,
  taskOrder,
  hiddenTaskIds,
  detailedCountTaskIds,
  characters,
  progress,
  isReadOnly,
  dispatch,
}: MatrixSectionProps) {
  const orderedTasks = useMemo(
    () => resolveTaskOrder(tasks, taskOrder),
    [tasks, taskOrder],
  )
  // Membership check only, not filtering: index/toIndex math for
  // drag-and-drop stays anchored to positions within the full taskOrder
  // array (see moveIdInOrder), so a hidden task keeps its slot even while
  // its row is not rendered.
  const hiddenTaskIdSet = useMemo(
    () => new Set(hiddenTaskIds ?? []),
    [hiddenTaskIds],
  )
  const detailedCountTaskIdSet = useMemo(
    () => new Set(detailedCountTaskIds ?? []),
    [detailedCountTaskIds],
  )
  const hasVisibleTask = orderedTasks.some(
    (task) => !hiddenTaskIdSet.has(task.id),
  )
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)

  const handleMove = (taskId: string, toIndex: number) => {
    dispatch(moveTask(section, taskId, toIndex))
  }

  const handleDragStart =
    (taskId: string, index: number) =>
    (event: DragEvent<HTMLButtonElement>) => {
      setDraggedTaskId(taskId)
      setDraggedIndex(index)
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', taskId)
    }

  const handleDragOver =
    (taskId: string) => (event: DragEvent<HTMLTableRowElement>) => {
      if (draggedTaskId === null || draggedTaskId === taskId) {
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDragOverTaskId(taskId)
    }

  const handleDragLeave = (taskId: string) => () => {
    setDragOverTaskId((current) => (current === taskId ? null : current))
  }

  const handleDrop =
    (taskId: string, index: number) =>
    (event: DragEvent<HTMLTableRowElement>) => {
      event.preventDefault()
      if (draggedTaskId !== null && draggedTaskId !== taskId) {
        handleMove(draggedTaskId, index)
      }
      setDraggedTaskId(null)
      setDraggedIndex(null)
      setDragOverTaskId(null)
    }

  const handleDragEnd = () => {
    setDraggedTaskId(null)
    setDraggedIndex(null)
    setDragOverTaskId(null)
  }

  if (!hasVisibleTask) {
    return (
      <div className="matrix-section">
        <div className="matrix-section-header">
          <h2>{title}</h2>
        </div>
        <p className="matrix-empty">{NO_VISIBLE_TASKS_MESSAGE}</p>
      </div>
    )
  }

  return (
    <div className="matrix-section">
      <div className="matrix-section-header">
        <h2>{title}</h2>
      </div>
      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th scope="col" className="matrix-handle-header" />
              <th scope="col" className="matrix-corner-cell">
                タスク
              </th>
              {characters.map((character) => (
                <th
                  scope="col"
                  className="matrix-character-header"
                  key={character.id}
                  title={character.name}
                >
                  <span className="matrix-character-name">
                    {character.name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedTasks.map((task, index) => {
              if (hiddenTaskIdSet.has(task.id)) {
                return null
              }
              const label = getTaskLabel(task)
              const { primary, note } = splitTaskLabel(label)
              const isDragging = draggedTaskId === task.id
              const isDragOver = dragOverTaskId === task.id
              const dragOverDirection: DragOverDirection =
                isDragOver && draggedIndex !== null
                  ? draggedIndex < index
                    ? 'below'
                    : 'above'
                  : null

              return (
                <tr
                  key={task.id}
                  className={classNames(
                    'matrix-row',
                    isDragging && 'matrix-row--dragging',
                    dragOverDirection === 'above' &&
                      'matrix-row--drag-over-above',
                    dragOverDirection === 'below' &&
                      'matrix-row--drag-over-below',
                  )}
                  onDragOver={handleDragOver(task.id)}
                  onDragLeave={handleDragLeave(task.id)}
                  onDrop={handleDrop(task.id, index)}
                >
                  <td className="matrix-handle-cell">
                    <button
                      type="button"
                      className="matrix-handle"
                      aria-label={`${label} をドラッグして並べ替え`}
                      draggable={!isReadOnly}
                      disabled={isReadOnly}
                      onDragStart={handleDragStart(task.id, index)}
                      onDragEnd={handleDragEnd}
                    >
                      <span aria-hidden="true">⠿</span>
                    </button>
                  </td>
                  <th
                    scope="row"
                    className="matrix-task-label"
                    style={{ borderLeftColor: resolveTaskColor(task.color) }}
                    title={label}
                  >
                    <span className="matrix-task-label-text">{primary}</span>
                    {note !== null && (
                      <span className="matrix-task-label-note">{note}</span>
                    )}
                  </th>
                  {characters.map((character) => (
                    <MatrixCell
                      key={character.id}
                      character={character}
                      task={task}
                      value={progressValue(progress, character.id, task.id)}
                      isDetailedCount={detailedCountTaskIdSet.has(task.id)}
                      isReadOnly={isReadOnly}
                      dispatch={dispatch}
                    />
                  ))}
                </tr>
              )
            })}
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
  isDetailedCount: boolean
  isReadOnly: boolean
  dispatch: Dispatch
}

function MatrixCell({
  character,
  task,
  value,
  isDetailedCount,
  isReadOnly,
  dispatch,
}: MatrixCellProps) {
  if (task.maxProgress === 1 || !isDetailedCount) {
    const isDone = isTaskComplete(value, task.maxProgress)
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
            dispatch(
              setProgress(character.id, task.id, isDone ? 0 : task.maxProgress),
            )
          }
        />
      </td>
    )
  }

  const isComplete = value === task.maxProgress
  const isOverMax = value > task.maxProgress
  const canDecrement = !isReadOnly && value > 0
  const canIncrement = !isReadOnly && value < task.maxProgress

  return (
    <td className="matrix-cell">
      <div className="matrix-counter-cell">
        <button
          type="button"
          className={classNames(
            'matrix-counter-increment',
            isOverMax
              ? 'matrix-counter-increment--over'
              : isComplete && 'matrix-counter-increment--complete',
          )}
          aria-label={`${character.name} ${getTaskLabel(task)} を増やす`}
          disabled={!canIncrement}
          onClick={() =>
            dispatch(setProgress(character.id, task.id, value + 1))
          }
        >
          {value}/{task.maxProgress}
        </button>
        <button
          type="button"
          className="matrix-counter-decrement"
          aria-label={`${character.name} ${getTaskLabel(task)} を減らす`}
          disabled={!canDecrement}
          onClick={() =>
            dispatch(setProgress(character.id, task.id, value - 1))
          }
        >
          −
        </button>
      </div>
    </td>
  )
}
