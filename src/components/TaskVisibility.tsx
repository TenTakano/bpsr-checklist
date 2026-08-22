import { getTaskLabel } from '../data/taskLabel'
import type { TaskCategory } from '../data/taskLookup'
import { PROJECT_TASKS_BY_RESET_CYCLE } from '../data/projectTasksResolver'
import type { ProjectTask } from '../data/projectTaskSchema'
import { TASK_SECTIONS } from '../data/taskSections'
import { setTaskDetailedCount, setTaskHidden } from '../store/actions'
import { useStore, type StoreContextValue } from '../store/context'

type Dispatch = StoreContextValue['dispatch']

export function TaskVisibility() {
  const { store, status, dispatch } = useStore()
  const isReadOnly = status === 'readonly'
  const hiddenTaskIds = new Set(store.hiddenTaskIds ?? [])
  const detailedCountTaskIds = new Set(store.detailedCountTaskIds ?? [])

  return (
    <section aria-label="タスク表示" className="task-visibility">
      <h3 className="modal-section-title">タスク表示</h3>
      {TASK_SECTIONS.map(({ title, cycle }) => (
        <TaskVisibilitySection
          key={cycle}
          title={title}
          category={cycle}
          tasks={PROJECT_TASKS_BY_RESET_CYCLE[cycle]}
          hiddenTaskIds={hiddenTaskIds}
          detailedCountTaskIds={detailedCountTaskIds}
          isReadOnly={isReadOnly}
          dispatch={dispatch}
        />
      ))}
    </section>
  )
}

interface TaskVisibilitySectionProps {
  title: string
  category: TaskCategory
  tasks: ProjectTask[]
  hiddenTaskIds: Set<string>
  detailedCountTaskIds: Set<string>
  isReadOnly: boolean
  dispatch: Dispatch
}

function TaskVisibilitySection({
  title,
  category,
  tasks,
  hiddenTaskIds,
  detailedCountTaskIds,
  isReadOnly,
  dispatch,
}: TaskVisibilitySectionProps) {
  return (
    <div className="task-visibility-section">
      <h4
        id={`task-visibility-section-${category}`}
        className="modal-subsection-title"
        tabIndex={-1}
      >
        {title}
      </h4>
      <ul className="task-visibility-list">
        {tasks.map((task) => {
          const label = getTaskLabel(task)
          const inputId = `task-visibility-${task.id}`
          const isChecked = !hiddenTaskIds.has(task.id)
          return (
            <li key={task.id} className="task-visibility-item">
              <input
                id={inputId}
                type="checkbox"
                className="checkbox-input"
                checked={isChecked}
                disabled={isReadOnly}
                onChange={(event) =>
                  dispatch(setTaskHidden(task.id, !event.target.checked))
                }
              />
              <label htmlFor={inputId} className="task-visibility-label">
                {label}
              </label>
              {task.maxProgress >= 2 && (
                <TaskDetailedCountToggle
                  task={task}
                  label={label}
                  isChecked={detailedCountTaskIds.has(task.id)}
                  isReadOnly={isReadOnly}
                  dispatch={dispatch}
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

interface TaskDetailedCountToggleProps {
  task: ProjectTask
  label: string
  isChecked: boolean
  isReadOnly: boolean
  dispatch: Dispatch
}

function TaskDetailedCountToggle({
  task,
  label,
  isChecked,
  isReadOnly,
  dispatch,
}: TaskDetailedCountToggleProps) {
  const inputId = `task-detailed-count-${task.id}`
  return (
    <span className="task-visibility-detail">
      <input
        id={inputId}
        type="checkbox"
        className="checkbox-input"
        checked={isChecked}
        disabled={isReadOnly}
        aria-label={`${label} を詳細カウント表示にする`}
        onChange={(event) =>
          dispatch(setTaskDetailedCount(task.id, event.target.checked))
        }
      />
      <label htmlFor={inputId} className="task-visibility-detail-label">
        詳細カウント表示
      </label>
    </span>
  )
}
