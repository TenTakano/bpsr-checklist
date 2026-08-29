import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import { getCurrentWeekdayJst } from '../data/resetConfig'
import { resolveTaskColor } from '../data/taskColors'
import { getTaskLabel, splitTaskLabel } from '../data/taskLabel'
import type { TaskCategory } from '../data/taskLookup'
import { resolveTaskOrder } from '../data/taskOrder'
import { PROJECT_TASKS_BY_RESET_CYCLE } from '../data/projectTasksResolver'
import type { ProjectTask } from '../data/projectTaskSchema'
import { TASK_SECTIONS } from '../data/taskSections'
import { summarizeCategoryProgress } from '../domain/progressSummary'
import { getExcludedTaskIds } from '../domain/taskAvailability'
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
  const currentWeekdayJst = getCurrentWeekdayJst(store.resetState?.daily)

  if (characters.length === 0) {
    return (
      <section aria-label="進捗マトリクス" className="matrix-view">
        <p className="matrix-empty">{NO_CHARACTERS_MESSAGE}</p>
      </section>
    )
  }

  return (
    <section aria-label="進捗マトリクス" className="matrix-view">
      {TASK_SECTIONS.map(({ title, cycle }) => (
        <MatrixSection
          key={cycle}
          title={title}
          section={cycle}
          tasks={PROJECT_TASKS_BY_RESET_CYCLE[cycle]}
          taskOrder={store.taskOrder?.[cycle]}
          hiddenTaskIds={store.hiddenTaskIds}
          currentWeekdayJst={currentWeekdayJst}
          detailedCountTaskIds={store.detailedCountTaskIds}
          characters={characters}
          progress={store.progress}
          isReadOnly={isReadOnly}
          dispatch={dispatch}
          onOpenTaskVisibility={(trigger) =>
            onOpenTaskVisibility(cycle, trigger)
          }
        />
      ))}
    </section>
  )
}

interface MatrixSectionProps {
  title: string
  section: TaskCategory
  tasks: ProjectTask[]
  taskOrder: string[] | undefined
  hiddenTaskIds: string[] | undefined
  currentWeekdayJst: number | undefined
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
  currentWeekdayJst,
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
  // Tasks not available on the current (game-day) weekday are excluded the
  // same way as manually hidden tasks: membership check only, never by
  // filtering the arrays fed into resolveTaskOrder/moveTask.
  const excludedTaskIds = useMemo(
    () => getExcludedTaskIds(tasks, hiddenTaskIds, currentWeekdayJst),
    [tasks, hiddenTaskIds, currentWeekdayJst],
  )
  const summary = useMemo(
    () =>
      summarizeCategoryProgress(tasks, characters, progress, excludedTaskIds),
    [tasks, characters, progress, excludedTaskIds],
  )
  // Membership check only, not filtering: index/toIndex math for
  // drag-and-drop stays anchored to positions within the full taskOrder
  // array (see moveIdInOrder), so a hidden task keeps its slot even while
  // its row is not rendered.
  const excludedTaskIdSet = useMemo(
    () => new Set(excludedTaskIds),
    [excludedTaskIds],
  )
  const detailedCountTaskIdSet = useMemo(
    () => new Set(detailedCountTaskIds ?? []),
    [detailedCountTaskIds],
  )
  const hasVisibleTask = orderedTasks.some(
    (task) => !excludedTaskIdSet.has(task.id),
  )
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)
  const [isCompletedGroupOpen, setIsCompletedGroupOpen] = useState(false)
  const [reorderAnnouncement, setReorderAnnouncement] = useState('')
  const handleRefs = useRef(new Map<string, HTMLButtonElement>())
  // Set alongside the moveTask dispatch (never inside the effect below) so
  // the effect only reads/clears it, avoiding a setState-in-effect cascade.
  const pendingFocusTaskIdRef = useRef<string | null>(null)
  // Alternates on every reorder announcement so two consecutive moves in the
  // same direction never produce identical aria-live text; screen readers
  // skip re-announcing a live region whose content didn't change.
  const announceWithMarkerRef = useRef(false)

  // A row is complete only once every currently displayed character has
  // completed it; this deliberately ignores any notion of an "active"
  // character.
  const isRowComplete = useCallback(
    (task: ProjectTask) =>
      characters.every((character) =>
        isTaskComplete(
          readProgressValue(progress, character.id, task.id),
          task.maxProgress,
        ),
      ),
    [characters, progress],
  )

  // Index reflects the position within the full taskOrder (orderedTasks),
  // matching the hidden-task handling below: filtering here is for display
  // only, drag-and-drop index math stays anchored to the unfiltered order.
  const visibleTaskEntries = useMemo(
    () =>
      orderedTasks
        .map((task, index) => ({ task, index }))
        .filter(({ task }) => !excludedTaskIdSet.has(task.id)),
    [orderedTasks, excludedTaskIdSet],
  )
  const normalTaskEntries = useMemo(
    () => visibleTaskEntries.filter(({ task }) => !isRowComplete(task)),
    [visibleTaskEntries, isRowComplete],
  )
  const completedTaskEntries = useMemo(
    () => visibleTaskEntries.filter(({ task }) => isRowComplete(task)),
    [visibleTaskEntries, isRowComplete],
  )

  const handleMove = (taskId: string, toIndex: number) => {
    dispatch(moveTask(section, taskId, toIndex))
  }

  // Reordering re-sorts normalTaskEntries, so React remounts/moves the
  // dragged handle's tr and it can lose focus. Re-focus it once the new
  // order has rendered; normalTaskEntries is memoized on the underlying
  // order/visibility/progress state, so a real move always yields a new
  // reference here and reliably re-runs this effect, even when the same
  // task is moved again immediately after.
  useEffect(() => {
    const taskId = pendingFocusTaskIdRef.current
    if (taskId === null) {
      return
    }
    handleRefs.current.get(taskId)?.focus()
    pendingFocusTaskIdRef.current = null
  }, [normalTaskEntries])

  const handleReorderKeyDown =
    (task: ProjectTask, label: string, position: number) =>
    (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
        return
      }
      event.preventDefault()
      const direction = event.key === 'ArrowUp' ? -1 : 1
      const targetPosition = position + direction
      if (targetPosition < 0 || targetPosition >= normalTaskEntries.length) {
        return
      }
      const targetEntry = normalTaskEntries[targetPosition]
      handleMove(task.id, targetEntry.index)
      pendingFocusTaskIdRef.current = task.id
      announceWithMarkerRef.current = !announceWithMarkerRef.current
      const message = `${label} を${direction < 0 ? '1つ上' : '1つ下'}に移動しました`
      setReorderAnnouncement(
        announceWithMarkerRef.current ? `${message}\u200b` : message,
      )
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
    task: ProjectTask,
    index: number,
    isCompletedRow: boolean,
    // undefined for completed rows: they render no reorder handle, so
    // there is no position for handleReorderKeyDown to move relative to.
    position: number | undefined,
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
          {!isCompletedRow && position !== undefined && (
            <button
              type="button"
              ref={(element) => {
                if (element) {
                  handleRefs.current.set(task.id, element)
                } else {
                  handleRefs.current.delete(task.id)
                }
              }}
              className="matrix-handle"
              aria-label={`${label} をドラッグまたは矢印キーで並べ替え`}
              draggable={!isReadOnly}
              disabled={isReadOnly}
              onDragStart={handleDragStart(task.id, index)}
              onDragEnd={handleDragEnd}
              onKeyDown={handleReorderKeyDown(task, label, position)}
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
      <p className="visually-hidden" role="status" aria-live="polite">
        {reorderAnnouncement}
      </p>
      <div className="matrix-scroll">
        <table className="matrix-table">
          <thead>
            <tr>
              <th scope="col" className="matrix-handle-header">
                <span className="visually-hidden">並べ替え</span>
              </th>
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
            {normalTaskEntries.map(({ task, index }, position) =>
              renderTaskRow(task, index, false, position),
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
                  renderTaskRow(task, index, true, undefined),
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
  task: ProjectTask
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
