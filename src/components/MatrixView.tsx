import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react'
import { CUSTOM_TASK_ID_PREFIX } from '../data/customTaskSchema'
import { resolveTaskColor } from '../data/taskColors'
import { splitTaskLabel } from '../data/taskLabel'
import type { TaskCategory } from '../data/taskLookup'
import { resolveTaskOrder } from '../data/taskOrder'
import { MATRIX_TASK_SECTIONS, TASK_SECTIONS } from '../data/taskSections'
import {
  getDisplayTasksByCategory,
  type DisplayTask,
} from '../domain/displayTasks'
import { summarizeCategoryProgress } from '../domain/progressSummary'
import { isTaskComplete, readProgressValue } from '../domain/taskProgress'
import { moveTask, setProgress } from '../store/actions'
import { useStore, type StoreContextValue } from '../store/context'
import type { Character } from '../store/schema'
import type { Store } from '../store/types'
import {
  ADD_CUSTOM_TASK_LABEL,
  NO_CHARACTERS_MESSAGE,
  NO_VISIBLE_TASKS_MESSAGE,
} from './messages'

type Dispatch = StoreContextValue['dispatch']
type DragOverDirection = 'above' | 'below' | null

// TaskVisibility only renders sections for TASK_SECTIONS (daily/weekly);
// milestone has no #task-visibility-section-milestone target yet, so its
// "表示タスク設定" trigger is withheld until TaskVisibility gains that
// section in a later PR.
const TASK_VISIBILITY_SUPPORTED_CATEGORIES = new Set<TaskCategory>(
  TASK_SECTIONS.map((section) => section.cycle),
)

function classNames(
  base: string,
  ...modifiers: (string | false | null | undefined)[]
): string {
  return [base, ...modifiers.filter(Boolean)].join(' ')
}

interface MatrixViewProps {
  onOpenTaskVisibility: (section: TaskCategory, trigger: HTMLElement) => void
  onAddCustomTask: (category: TaskCategory, trigger: HTMLElement) => void
  onEditCustomTask: (
    task: DisplayTask,
    category: TaskCategory,
    trigger: HTMLElement,
  ) => void
}

export function MatrixView({
  onOpenTaskVisibility,
  onAddCustomTask,
  onEditCustomTask,
}: MatrixViewProps) {
  const { store, status, dispatch } = useStore()
  const isReadOnly = status === 'readonly'
  const characters = store.characters
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

  if (characters.length === 0) {
    return (
      <section aria-label="進捗マトリクス" className="matrix-view">
        <p className="matrix-empty">{NO_CHARACTERS_MESSAGE}</p>
      </section>
    )
  }

  return (
    <section aria-label="進捗マトリクス" className="matrix-view">
      {MATRIX_TASK_SECTIONS.map(({ title, category }) => (
        <MatrixSection
          key={category}
          title={title}
          section={category}
          tasks={tasksByCategory.get(category) ?? []}
          taskOrder={store.taskOrder?.[category]}
          hiddenTaskIds={store.hiddenTaskIds}
          detailedCountTaskIds={store.detailedCountTaskIds}
          characters={characters}
          progress={store.progress}
          isReadOnly={isReadOnly}
          dispatch={dispatch}
          canOpenTaskVisibility={TASK_VISIBILITY_SUPPORTED_CATEGORIES.has(
            category,
          )}
          onOpenTaskVisibility={(trigger) =>
            onOpenTaskVisibility(category, trigger)
          }
          onAddCustomTask={(trigger) => onAddCustomTask(category, trigger)}
          onEditCustomTask={(task, trigger) =>
            onEditCustomTask(task, category, trigger)
          }
        />
      ))}
    </section>
  )
}

interface MatrixSectionProps {
  title: string
  section: TaskCategory
  tasks: DisplayTask[]
  taskOrder: string[] | undefined
  hiddenTaskIds: string[] | undefined
  detailedCountTaskIds: string[] | undefined
  characters: Character[]
  progress: Store['progress']
  isReadOnly: boolean
  dispatch: Dispatch
  canOpenTaskVisibility: boolean
  onOpenTaskVisibility: (trigger: HTMLElement) => void
  onAddCustomTask: (trigger: HTMLElement) => void
  onEditCustomTask: (task: DisplayTask, trigger: HTMLElement) => void
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
  canOpenTaskVisibility,
  onOpenTaskVisibility,
  onAddCustomTask,
  onEditCustomTask,
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
    (task: DisplayTask) =>
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
        .filter(({ task }) => !hiddenTaskIdSet.has(task.id)),
    [orderedTasks, hiddenTaskIdSet],
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
    (task: DisplayTask, label: string, position: number) =>
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
    task: DisplayTask,
    index: number,
    isCompletedRow: boolean,
    // undefined for completed rows: they render no reorder handle, so
    // there is no position for handleReorderKeyDown to move relative to.
    position: number | undefined,
  ) => {
    const label = task.label
    const { primary, note } = splitTaskLabel(label)
    const isCustomTask = task.id.startsWith(CUSTOM_TASK_ID_PREFIX)
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
          {isCustomTask && (
            <button
              type="button"
              className="matrix-task-edit-button"
              aria-label={`${label} を編集`}
              disabled={isReadOnly}
              onClick={(event) => onEditCustomTask(task, event.currentTarget)}
            >
              編集
            </button>
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

  const colSpan = characters.length + 2

  // No visible tasks: either the category has zero tasks combined (e.g.
  // milestone before any custom task exists) or every task is hidden via
  // TaskVisibility. Either way the section still renders so the add-row
  // stays reachable as an entry point for creating/restoring a task; the
  // empty-state message is only shown for the "has tasks, all hidden" case.
  if (!hasVisibleTask) {
    return (
      <div className="matrix-section">
        <MatrixSectionHeader
          title={title}
          completed={summary.completed}
          total={summary.total}
          canOpenTaskVisibility={canOpenTaskVisibility}
          onOpenTaskVisibility={onOpenTaskVisibility}
        />
        {tasks.length > 0 && (
          <p className="matrix-empty">{NO_VISIBLE_TASKS_MESSAGE}</p>
        )}
        <div className="matrix-scroll">
          <table className="matrix-table">
            <MatrixTableHead characters={characters} />
            <tbody>
              <AddCustomTaskRow
                colSpan={colSpan}
                isReadOnly={isReadOnly}
                onAddCustomTask={onAddCustomTask}
              />
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="matrix-section">
      <MatrixSectionHeader
        title={title}
        completed={summary.completed}
        total={summary.total}
        canOpenTaskVisibility={canOpenTaskVisibility}
        onOpenTaskVisibility={onOpenTaskVisibility}
      />
      <p className="visually-hidden" role="status" aria-live="polite">
        {reorderAnnouncement}
      </p>
      <div className="matrix-scroll">
        <table className="matrix-table">
          <MatrixTableHead characters={characters} />
          <tbody>
            {normalTaskEntries.map(({ task, index }, position) =>
              renderTaskRow(task, index, false, position),
            )}
            <AddCustomTaskRow
              colSpan={colSpan}
              isReadOnly={isReadOnly}
              onAddCustomTask={onAddCustomTask}
            />
          </tbody>
          {completedTaskEntries.length > 0 && (
            <tbody>
              <tr className="matrix-accordion-toggle-row">
                <td className="matrix-accordion-toggle-cell" colSpan={colSpan}>
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

interface MatrixTableHeadProps {
  characters: Character[]
}

function MatrixTableHead({ characters }: MatrixTableHeadProps) {
  return (
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
            <span className="matrix-character-name">{character.name}</span>
          </th>
        ))}
      </tr>
    </thead>
  )
}

interface AddCustomTaskRowProps {
  colSpan: number
  isReadOnly: boolean
  onAddCustomTask: (trigger: HTMLElement) => void
}

function AddCustomTaskRow({
  colSpan,
  isReadOnly,
  onAddCustomTask,
}: AddCustomTaskRowProps) {
  return (
    <tr className="matrix-add-row">
      <td colSpan={colSpan}>
        <button
          type="button"
          className="matrix-add-row-button"
          disabled={isReadOnly}
          onClick={(event) => onAddCustomTask(event.currentTarget)}
        >
          {ADD_CUSTOM_TASK_LABEL}
        </button>
      </td>
    </tr>
  )
}

interface MatrixSectionHeaderProps {
  title: string
  completed: number
  total: number
  canOpenTaskVisibility: boolean
  onOpenTaskVisibility: (trigger: HTMLElement) => void
}

function MatrixSectionHeader({
  title,
  completed,
  total,
  canOpenTaskVisibility,
  onOpenTaskVisibility,
}: MatrixSectionHeaderProps) {
  return (
    <div className="matrix-section-header">
      <h2>{title}</h2>
      <span className="matrix-section-progress">
        {completed} / {total} 完了
      </span>
      <span className="matrix-section-spacer" />
      {canOpenTaskVisibility && (
        <button
          type="button"
          className="matrix-section-action"
          onClick={(event) => onOpenTaskVisibility(event.currentTarget)}
        >
          表示タスク設定
        </button>
      )}
    </div>
  )
}

interface MatrixCellProps {
  character: Character
  task: DisplayTask
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
          aria-label={`${character.name} ${task.label}`}
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
          aria-label={`${character.name} ${task.label} を増やす`}
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
          aria-label={`${character.name} ${task.label} を減らす`}
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
