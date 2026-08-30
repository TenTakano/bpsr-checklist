import { resolveTaskColor } from '../data/taskColors'
import { resolveTaskOrderIds } from '../data/taskOrder'
import { MATRIX_TASK_SECTIONS } from '../data/taskSections'
import { removeCustomTask } from '../store/actions'
import { useStore } from '../store/context'
import type { CustomTask } from '../store/schema'
import {
  NO_CUSTOM_TASKS_IN_CATEGORY_MESSAGE,
  NO_CUSTOM_TASKS_MESSAGE,
} from './messages'

export function CustomTaskManager() {
  const { store, status, dispatch } = useStore()
  const isReadOnly = status === 'readonly'
  const customTasks = store.customTasks ?? []
  const customTaskById = new Map(customTasks.map((task) => [task.id, task]))

  const handleRemove = (id: string, name: string) => {
    const confirmed = window.confirm(
      `「${name}」を削除しますか？この操作は取り消せません。`,
    )
    if (!confirmed) {
      return
    }
    dispatch(removeCustomTask(id))
  }

  return (
    <section aria-label="カスタムタスク" className="custom-task-manager">
      <h3 className="modal-section-title">カスタムタスク</h3>
      {customTasks.length === 0 ? (
        <p className="custom-task-manager-empty">{NO_CUSTOM_TASKS_MESSAGE}</p>
      ) : (
        MATRIX_TASK_SECTIONS.map(({ title, category }) => {
          const orderedIds = resolveTaskOrderIds(
            category,
            store.taskOrder?.[category],
            store.customTasks,
          )
          const tasksInCategory = orderedIds
            .map((id) => customTaskById.get(id))
            .filter((task): task is CustomTask => task !== undefined)

          return (
            <div key={category} className="custom-task-manager-section">
              <h4 className="modal-subsection-title">
                {title}のカスタムタスク
              </h4>
              {tasksInCategory.length === 0 ? (
                <p className="custom-task-manager-empty">
                  {NO_CUSTOM_TASKS_IN_CATEGORY_MESSAGE}
                </p>
              ) : (
                <ul className="custom-task-manager-list">
                  {tasksInCategory.map((task) => (
                    <li key={task.id} className="custom-task-manager-row">
                      <span
                        className="custom-task-manager-swatch"
                        style={{
                          backgroundColor: resolveTaskColor(task.color),
                        }}
                        aria-hidden="true"
                      />
                      <span className="custom-task-manager-name">
                        {task.name}
                      </span>
                      <button
                        type="button"
                        className="btn btn--danger"
                        disabled={isReadOnly}
                        onClick={() => handleRemove(task.id, task.name)}
                      >
                        削除
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })
      )}
    </section>
  )
}
