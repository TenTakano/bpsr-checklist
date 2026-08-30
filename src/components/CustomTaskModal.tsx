import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from 'react'
import {
  MAX_CUSTOM_TASK_MAX_PROGRESS,
  MAX_CUSTOM_TASK_NAME_LENGTH,
  MAX_CUSTOM_TASKS,
  MIN_CUSTOM_TASK_MAX_PROGRESS,
} from '../data/customTaskSchema'
import {
  TASK_COLOR_LABELS_JA,
  TASK_COLOR_TOKENS,
  resolveTaskColor,
  type TaskColorToken,
} from '../data/taskColors'
import type { TaskCategory } from '../data/taskLookup'
import { MATRIX_TASK_SECTIONS } from '../data/taskSections'
import { addCustomTask, updateCustomTask } from '../store/actions'
import { useStore } from '../store/context'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export const CUSTOM_TASK_LIMIT_MESSAGE = `カスタムタスクは最大${MAX_CUSTOM_TASKS}件までのため、これ以上追加できません。`
export const CUSTOM_TASK_NAME_REQUIRED_MESSAGE = '名前を入力してください。'
export const CUSTOM_TASK_NAME_TOO_LONG_MESSAGE = `名前は${MAX_CUSTOM_TASK_NAME_LENGTH}文字以内で入力してください。`
export const CUSTOM_TASK_MAX_PROGRESS_RANGE_MESSAGE = `${MIN_CUSTOM_TASK_MAX_PROGRESS}〜${MAX_CUSTOM_TASK_MAX_PROGRESS}の整数を入力してください。`

interface CustomTaskModalProps {
  mode: 'add' | 'edit'
  category: TaskCategory
  taskId?: string
  onClose: () => void
}

export function CustomTaskModal({
  mode,
  category,
  taskId,
  onClose,
}: CustomTaskModalProps) {
  const { store, status, dispatch } = useStore()
  const isReadOnly = status === 'readonly'
  const dialogRef = useRef<HTMLDivElement>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const nameFieldId = useId()
  const categoryFieldId = useId()
  const maxProgressFieldId = useId()
  const colorGroupLabelId = useId()

  const existingTask =
    mode === 'edit'
      ? ((store.customTasks ?? []).find((task) => task.id === taskId) ?? null)
      : null

  const [name, setName] = useState(existingTask?.name ?? '')
  const [selectedCategory, setSelectedCategory] = useState<TaskCategory>(
    existingTask?.category ?? category,
  )
  const [color, setColor] = useState<TaskColorToken>(
    existingTask?.color ?? TASK_COLOR_TOKENS[0],
  )
  const [maxProgressInput, setMaxProgressInput] = useState(
    String(existingTask?.maxProgress ?? 1),
  )
  const [nameError, setNameError] = useState<string | null>(null)
  const [maxProgressError, setMaxProgressError] = useState<string | null>(null)

  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  // Defends against the edit target having been removed from the store
  // (e.g. via a concurrent import) between the trigger click and this
  // render; there is nothing meaningful left to edit, so close immediately.
  useEffect(() => {
    if (mode === 'edit' && existingTask === null) {
      onClose()
    }
  }, [mode, existingTask, onClose])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab' || dialogRef.current === null) {
        return
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )
      if (focusable.length === 0) {
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose()
    }
  }

  const isAtLimit =
    mode === 'add' && (store.customTasks?.length ?? 0) >= MAX_CUSTOM_TASKS

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isAtLimit) {
      return
    }

    const trimmedName = name.trim()
    let hasError = false

    if (trimmedName.length === 0) {
      setNameError(CUSTOM_TASK_NAME_REQUIRED_MESSAGE)
      hasError = true
    } else if (trimmedName.length > MAX_CUSTOM_TASK_NAME_LENGTH) {
      setNameError(CUSTOM_TASK_NAME_TOO_LONG_MESSAGE)
      hasError = true
    } else {
      setNameError(null)
    }

    const maxProgressValue = Number(maxProgressInput)
    if (
      !Number.isInteger(maxProgressValue) ||
      maxProgressValue < MIN_CUSTOM_TASK_MAX_PROGRESS ||
      maxProgressValue > MAX_CUSTOM_TASK_MAX_PROGRESS
    ) {
      setMaxProgressError(CUSTOM_TASK_MAX_PROGRESS_RANGE_MESSAGE)
      hasError = true
    } else {
      setMaxProgressError(null)
    }

    if (hasError) {
      return
    }

    if (mode === 'add') {
      dispatch(
        addCustomTask(trimmedName, color, maxProgressValue, selectedCategory),
      )
    } else if (existingTask !== null) {
      dispatch(
        updateCustomTask(
          existingTask.id,
          trimmedName,
          color,
          maxProgressValue,
          existingTask.category,
        ),
      )
    }
    onClose()
  }

  if (mode === 'edit' && existingTask === null) {
    return null
  }

  const title = mode === 'add' ? 'タスクを追加' : 'タスクを編集'

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-task-modal-title"
      >
        <div className="modal-header">
          <h2 id="custom-task-modal-title">{title}</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <form className="custom-task-form" onSubmit={handleSubmit} noValidate>
            {isAtLimit && (
              <p role="alert" className="custom-task-limit-message">
                {CUSTOM_TASK_LIMIT_MESSAGE}
              </p>
            )}

            <div className="custom-task-form-field">
              <label htmlFor={nameFieldId}>名前</label>
              <input
                id={nameFieldId}
                ref={nameInputRef}
                className="text-input"
                value={name}
                maxLength={MAX_CUSTOM_TASK_NAME_LENGTH}
                disabled={isReadOnly}
                onChange={(event) => {
                  setName(event.target.value)
                  setNameError(null)
                }}
              />
              {nameError !== null && (
                <p role="alert" className="custom-task-field-error">
                  {nameError}
                </p>
              )}
            </div>

            <div className="custom-task-form-field">
              <label htmlFor={categoryFieldId}>カテゴリ</label>
              <select
                id={categoryFieldId}
                className="text-input"
                value={selectedCategory}
                disabled={isReadOnly || mode === 'edit'}
                onChange={(event) =>
                  setSelectedCategory(event.target.value as TaskCategory)
                }
              >
                {MATRIX_TASK_SECTIONS.map(
                  ({ title: sectionTitle, category: optionCategory }) => (
                    <option key={optionCategory} value={optionCategory}>
                      {sectionTitle}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="custom-task-form-field">
              <span id={colorGroupLabelId}>色</span>
              <div
                className="custom-task-color-list"
                role="group"
                aria-labelledby={colorGroupLabelId}
              >
                {TASK_COLOR_TOKENS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    className={[
                      'custom-task-color-swatch',
                      color === token
                        ? 'custom-task-color-swatch--selected'
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ backgroundColor: resolveTaskColor(token) }}
                    aria-label={`色: ${TASK_COLOR_LABELS_JA[token]}`}
                    aria-pressed={color === token}
                    disabled={isReadOnly}
                    onClick={() => setColor(token)}
                  />
                ))}
              </div>
            </div>

            <div className="custom-task-form-field">
              <label htmlFor={maxProgressFieldId}>目標回数</label>
              <input
                id={maxProgressFieldId}
                type="number"
                className="text-input"
                value={maxProgressInput}
                min={MIN_CUSTOM_TASK_MAX_PROGRESS}
                max={MAX_CUSTOM_TASK_MAX_PROGRESS}
                disabled={isReadOnly}
                onChange={(event) => {
                  setMaxProgressInput(event.target.value)
                  setMaxProgressError(null)
                }}
              />
              {maxProgressError !== null && (
                <p role="alert" className="custom-task-field-error">
                  {maxProgressError}
                </p>
              )}
            </div>

            <div className="custom-task-form-actions">
              <button type="button" className="btn" onClick={onClose}>
                キャンセル
              </button>
              <button
                type="submit"
                className="btn"
                disabled={isReadOnly || isAtLimit}
              >
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
