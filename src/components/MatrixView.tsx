import { useMemo, useState, type DragEvent } from 'react'
import { resolveTaskColor } from '../data/taskColors'
import { getTaskLabel, splitTaskLabel } from '../data/taskLabel'
import type { TaskCategory } from '../data/taskLookup'
import { resolveTaskOrder } from '../data/taskOrder'
import { DAILY_TASKS, WEEKLY_TASKS } from '../data/projectTasksResolver'
import type { Task } from '../data/taskSchema'
import { summarizeCategoryProgress } from '../domain/progressSummary'
import { isTaskComplete, readProgressValue } from '../domain/taskProgress'
import { moveTask, setProgress } from '../store/actions'
import { useStore, type StoreContextValue } from '../store/context'
import type { Character } from '../store/schema'
import type { Store } from '../store/types'
import { NO_CHARACTERS_MESSAGE, NO_VISIBLE_TASKS_MESSAGE } from './messages'

type Dispatch = StoreContextValue['dispatch']
type DragOverDirection = 'above' | 'below' | null

function classNames(
  base: string,
  ...modifiers: (string | false | null | undefined)[]
): string {
  return [base, ...modifiers.filter(Boolean)].join(' ')
}

interface MatrixViewProps {
  onOpenTaskVisibility: (section: TaskCategory, trigger: HTMLElement) => void
}

export function MatrixView({ onOpenTaskVisibility }: MatrixViewProps) {
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
        onOpenTaskVisibility={(trigger) =>
          onOpenTaskVisibility('daily', trigger)
        }
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
        onOpenTaskVisibility={(trigger) =>
          onOpenTaskVisibility('weekly', trigger)
        }
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
  onOpenTaskVisibility: (trigger: HTMLElement) => void
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
  onOpenTaskVisibility,
}: MatrixSectionProps) {
  const orderedTasks = useMemo(
    () => resolveTaskOrder(tasks, taskOrder),
    [tasks, taskOrder],
  )
  const summary = useMemo(
    () => summarizeCategoryProgress(tasks, characters, progress, hiddenTaskIds),
    [tasks, characters, progress, hiddenTaskIds],
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
  const [isCompletedGroupOpen, setIsCompletedGroupOpen] = useState(false)

  // A row is complete only once every currently displayed character has
  // completed it; this deliberately ignores any notion of an "active"
  // character.
  const isRowComplete = (task: Task) =>
    characters.every((character) =>
      isTaskComplete(
        readProgressValue(progress, character.id, task.id),
        task.maxProgress,
      ),
    )

  // Index reflects the position within the full taskOrder (orderedTasks),
  // matching the hidden-task handling below: filtering here is for display
  // only, drag-and-drop index math stays anchored to the unfiltered order.
  const visibleTaskEntries = orderedTasks
    .map((task, index) => ({ task, index }))
    .filter(({ task }) => !hiddenTaskIdSet.has(task.id))
  const normalTaskEntries = visibleTaskEntries.filter(
    ({ task }) => !isRowComplete(task),
  )
  const completedTaskEntries = visibleTaskEntries.filter(({ task }) =>
    isRowComplete(task),
  )

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

  const renderTaskRow = (
    task: Task,
    index: number,
    isCompletedRow: boolean,
  ) => {
    const label = getTaskLabel(task)
    const { primary, note } = splitTaskLabel(label)
    const isDragging = !isCompletedRow && draggedTaskId === task.id
    const isDragOver = !isCompletedRow && dragOverTaskId === task.id
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
          isCompletedRow && 'matrix-row--completed',
          isDragging && 'matrix-row--dragging',
          dragOverDirection === 'above' && 'matrix-row--drag-over-above',
          dragOverDirection === 'below' && 'matrix-row--drag-over-below',
        )}
        onDragOver={isCompletedRow ? undefined : handleDragOver(task.id)}
        onDragLeave={isCompletedRow ? undefined : handleDragLeave(task.id)}
        onDrop={isCompletedRow ? undefined : handleDrop(task.id, index)}
      >
        <td className="matrix-handle-cell">
          {!isCompletedRow && (
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
          )}
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
            value={readProgressValue(progress, character.id, task.id)}
            isDetailedCount={detailedCountTaskIdSet.has(task.id)}
            isReadOnly={isReadOnly}
            dispatch={dispatch}
          />
        ))}
      </tr>
    )
  }

  if (!hasVisibleTask) {
    return (
      <div className="matrix-section">
        <MatrixSectionHeader
          title={title}
          completed={summary.completed}
          total={summary.total}
          onOpenTaskVisibility={onOpenTaskVisibility}
        />
        <p className="matrix-empty">{NO_VISIBLE_TASKS_MESSAGE}</p>
      </div>
    )
  }

  return (
    <div className="matrix-section">
      <MatrixSectionHeader
        title={title}
        completed={summary.completed}
        total={summary.total}
        onOpenTaskVisibility={onOpenTaskVisibility}
      />
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
            {normalTaskEntries.map(({ task, index }) =>
              renderTaskRow(task, index, false),
            )}
          </tbody>
          {completedTaskEntries.length > 0 && (
            <tbody>
              <tr className="matrix-accordion-toggle-row">
                <td
                  className="matrix-accordion-toggle-cell"
                  colSpan={characters.length + 2}
                >
                  <button
                    type="button"
                    className="matrix-accordion-toggle"
                    aria-expanded={isCompletedGroupOpen}
                    onClick={() =>
                      setIsCompletedGroupOpen((current) => !current)
                    }
                  >
                    <span aria-hidden="true">
                      {isCompletedGroupOpen ? '▼' : '▶'}
                    </span>
                    完了済み（{completedTaskEntries.length}）
                  </button>
                </td>
              </tr>
              {isCompletedGroupOpen &&
                completedTaskEntries.map(({ task, index }) =>
                  renderTaskRow(task, index, true),
                )}
            </tbody>
          )}
        </table>
      </div>
    </div>
  )
}

interface MatrixSectionHeaderProps {
  title: string
  completed: number
  total: number
  onOpenTaskVisibility: (trigger: HTMLElement) => void
}

function MatrixSectionHeader({
  title,
  completed,
  total,
  onOpenTaskVisibility,
}: MatrixSectionHeaderProps) {
  return (
    <div className="matrix-section-header">
      <h2>{title}</h2>
      <span className="matrix-section-progress">
        {completed} / {total} 完了
      </span>
      <span className="matrix-section-spacer" />
      <button
        type="button"
        className="matrix-section-action"
        onClick={(event) => onOpenTaskVisibility(event.currentTarget)}
      >
        表示タスク設定
      </button>
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
