import { useRef, useState, type ChangeEvent } from 'react'
import {
  applyBackup,
  backupFileName,
  buildBackupEnvelope,
  parseBackupFile,
  serializeBackupEnvelope,
} from '../store/backup'
import { useStore } from '../store/context'
import { SAVE_ERROR_MESSAGE } from '../store/StoreProvider'
import { readStoredTheme } from '../store/theme'

const IMPORT_CONFIRM_MESSAGE =
  'インポートすると現在のすべてのデータが上書きされます。上書き前のデータはブラウザ内に退避されますが、自動的には削除されず、アプリの画面から復元することもできません（復元にはブラウザの開発者ツールでの操作が必要です）。\n\nリセット期間によっては一部の進捗が反映されない場合があります。\n\n続行しますか？'
export const FILE_READ_ERROR_MESSAGE = 'ファイルの読み込みに失敗しました。'

const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024
export const FILE_TOO_LARGE_MESSAGE = `ファイルサイズが大きすぎます（上限${
  MAX_IMPORT_FILE_SIZE_BYTES / (1024 * 1024)
}MB）。`

export function ExportImportPanel() {
  const { store, status } = useStore()
  const isReadOnly = status === 'readonly'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleExport = () => {
    const now = new Date()
    const envelope = buildBackupEnvelope(store, readStoredTheme(), now)
    const json = serializeBackupEnvelope(envelope)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = backupFileName(now)
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    // Some browsers (notably Safari) start the download asynchronously, so
    // revoking the Blob URL synchronously can cancel it before it starts.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const handleImportClick = () => {
    setErrorMessage(null)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file === undefined) {
      return
    }

    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      setErrorMessage(FILE_TOO_LARGE_MESSAGE)
      return
    }

    let raw: string
    try {
      raw = await file.text()
    } catch {
      setErrorMessage(FILE_READ_ERROR_MESSAGE)
      return
    }

    const result = parseBackupFile(raw)
    if (result.status === 'error') {
      setErrorMessage(result.message)
      return
    }

    const confirmed = window.confirm(IMPORT_CONFIRM_MESSAGE)
    if (!confirmed) {
      return
    }

    const applyResult = applyBackup(result.backup)
    if (applyResult.status === 'error') {
      setErrorMessage(SAVE_ERROR_MESSAGE)
      return
    }

    window.location.reload()
  }

  return (
    <section aria-label="バックアップ" className="export-import-panel">
      <h3 className="modal-section-title">バックアップ</h3>
      <div className="export-import-actions">
        <button
          type="button"
          className="btn"
          disabled={isReadOnly}
          onClick={handleExport}
        >
          エクスポート
        </button>
        <button
          type="button"
          className="btn"
          disabled={isReadOnly}
          onClick={handleImportClick}
        >
          インポート
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="export-import-file-input"
          aria-label="バックアップファイルを選択"
          disabled={isReadOnly}
          onChange={handleFileChange}
        />
      </div>
      {errorMessage !== null && (
        <p role="alert" className="export-import-error">
          {errorMessage}
        </p>
      )}
    </section>
  )
}
