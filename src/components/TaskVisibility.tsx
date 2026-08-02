import upstreamTasksDocument from '../data/upstreamTasks.json'
import { getTaskLabel } from '../data/taskLabel'
import type { Task } from '../data/taskSchema'
import { setTaskHidden } from '../store/actions'
import { useStore, type StoreContextValue } from '../store/context'

const DAILY_TASKS: Task[] = upstreamTasksDocument.daily
const WEEKLY_TASKS: Task[] = upstreamTasksDocument.weekly

type Dispatch = StoreContextValue['dispatch']

export function TaskVisibility() {
  const { store, status, dispatch } = useStore()
  const isReadOnly = status === 'readonly'
  const hiddenTaskIds = new Set(store.hiddenTaskIds ?? [])

  return (
    <section aria-label="タスク表示" className="task-visibility">
      <h3 className="modal-section-title">タスク表示</h3>
      <TaskVisibilitySection
        title="デイリー"
        tasks={DAILY_TASKS}
        hiddenTaskIds={hiddenTaskIds}
        isReadOnly={isReadOnly}
        dispatch={dispatch}
      />
      <TaskVisibilitySection
        title="ウィークリー"
        tasks={WEEKLY_TASKS}
        hiddenTaskIds={hiddenTaskIds}
        isReadOnly={isReadOnly}
        dispatch={dispatch}
      />
    </section>
  )
}

interface TaskVisibilitySectionProps {
  title: string
  tasks: Task[]
  hiddenTaskIds: Set<string>
  isReadOnly: boolean
  dispatch: Dispatch
}

function TaskVisibilitySection({
  title,
  tasks,
  hiddenTaskIds,
  isReadOnly,
  dispatch,
}: TaskVisibilitySectionProps) {
  return (
    <div className="task-visibility-section">
      <h4 className="modal-subsection-title">{title}</h4>
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
            </li>
          )
        })}
      </ul>
    </div>
  )
}
