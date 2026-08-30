import { useEffect, useRef, type MouseEvent } from 'react'
import type { TaskCategory } from '../data/taskLookup'
import { CharacterManager } from './CharacterManager'
import { ExportImportPanel } from './ExportImportPanel'
import { TaskVisibility } from './TaskVisibility'

interface SettingsModalProps {
  onClose: () => void
  initialFocusSection?: TaskCategory | null
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function SettingsModal({
  onClose,
  initialFocusSection = null,
}: SettingsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (initialFocusSection !== null) {
      const sectionHeading = dialogRef.current?.querySelector<HTMLElement>(
        `#task-visibility-section-${initialFocusSection}`,
      )
      if (sectionHeading !== null && sectionHeading !== undefined) {
        sectionHeading.scrollIntoView()
        sectionHeading.focus()
        return
      }
    }

    const nameInput = dialogRef.current?.querySelector<HTMLInputElement>(
      '#new-character-name',
    )
    nameInput?.focus()
  }, [initialFocusSection])

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

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <div className="modal-header">
          <h2 id="settings-modal-title">設定</h2>
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
          <CharacterManager />
          <TaskVisibility />
          <ExportImportPanel />
        </div>
      </div>
    </div>
  )
}
