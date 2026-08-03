import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { storeWithCharacter } from '../test/fixtures'
import { STORAGE_KEY } from '../store/persistence'
import { EXPORT_VERSION, INVALID_JSON_MESSAGE } from '../store/backup'
import { SAVE_ERROR_MESSAGE } from '../store/StoreProvider'
import { THEME_STORAGE_KEY } from '../store/theme'
import type { Store } from '../store/types'
import { StoreContext, type StoreContextValue } from '../store/context'
import {
  ExportImportPanel,
  FILE_READ_ERROR_MESSAGE,
  FILE_TOO_LARGE_MESSAGE,
} from './ExportImportPanel'

const buildValidBackupRaw = (store: Store): string =>
  JSON.stringify({
    version: EXPORT_VERSION,
    exportedAt: '2026-08-03T00:00:00.000Z',
    theme: null,
    store,
  })

const renderWithContext = (overrides: Partial<StoreContextValue> = {}) => {
  const dispatch = vi.fn()
  const value: StoreContextValue = {
    store: storeWithCharacter(),
    status: 'ok',
    message: null,
    dispatch,
    ...overrides,
  }
  render(
    <StoreContext.Provider value={value}>
      <ExportImportPanel />
    </StoreContext.Provider>,
  )
}

const originalLocation = window.location

const mockLocationReload = (): (() => void) => {
  const reloadMock = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, reload: reloadMock },
  })
  return reloadMock
}

const restoreLocation = () => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  })
}

afterEach(() => {
  restoreLocation()
})

describe('ExportImportPanel / readonly mode', () => {
  it('disables the export and import controls instead of hiding them', () => {
    renderWithContext({ status: 'readonly' })
    expect(screen.getByRole('button', { name: 'エクスポート' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'インポート' })).toBeDisabled()
    expect(screen.getByLabelText('バックアップファイルを選択')).toBeDisabled()
  })
})

describe('ExportImportPanel / export', () => {
  afterEach(() => {
    // @ts-expect-error jsdom does not implement createObjectURL/revokeObjectURL
    delete URL.createObjectURL
    // @ts-expect-error jsdom does not implement createObjectURL/revokeObjectURL
    delete URL.revokeObjectURL
  })

  it('creates a downloadable file with the expected filename when Export is clicked', async () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    let downloadName: string | null = null
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloadName = this.download
    })

    renderWithContext()
    await userEvent.click(screen.getByRole('button', { name: 'エクスポート' }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    await waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url'),
    )
    expect(downloadName).toMatch(
      /^bpsr-checklist-backup-\d{4}-\d{2}-\d{2}\.json$/,
    )
  })

  it('includes the store data and the stored theme in the exported JSON', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:mock-url')
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const store = storeWithCharacter()
    renderWithContext({ store })
    await userEvent.click(screen.getByRole('button', { name: 'エクスポート' }))

    const [blob] = createObjectURL.mock.calls[0] ?? []
    const json = JSON.parse(await blob!.text())
    expect(json.theme).toBe('dark')
    expect(json.store).toEqual(store)
  })
})

describe('ExportImportPanel / import file selection', () => {
  it('clicking インポート opens the hidden file picker', async () => {
    const clickSpy = vi
      .spyOn(HTMLInputElement.prototype, 'click')
      .mockImplementation(() => {})
    renderWithContext()
    await userEvent.click(screen.getByRole('button', { name: 'インポート' }))
    expect(clickSpy).toHaveBeenCalled()
  })

  it('does nothing when the file picker is cancelled without a file selected', async () => {
    renderWithContext()
    fireEvent.change(screen.getByLabelText('バックアップファイルを選択'), {
      target: { files: [] },
    })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('shows an error message when the selected file is not a valid backup', async () => {
    renderWithContext()
    const file = new File(['{not valid json'], 'backup.json', {
      type: 'application/json',
    })
    await userEvent.upload(
      screen.getByLabelText('バックアップファイルを選択'),
      file,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      INVALID_JSON_MESSAGE,
    )
  })

  it('asks for confirmation and reloads after applying a valid backup', async () => {
    const reloadMock = mockLocationReload()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderWithContext()
    const backupStore = storeWithCharacter()
    const raw = buildValidBackupRaw(backupStore)
    const file = new File([raw], 'backup.json', { type: 'application/json' })

    await userEvent.upload(
      screen.getByLabelText('バックアップファイルを選択'),
      file,
    )

    expect(confirmSpy).toHaveBeenCalled()
    expect(localStorage.getItem(STORAGE_KEY)).toBe(JSON.stringify(backupStore))
    expect(reloadMock).toHaveBeenCalled()
  })

  it('does not write to storage or reload when confirmation is cancelled', async () => {
    const reloadMock = mockLocationReload()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderWithContext()
    const raw = buildValidBackupRaw(storeWithCharacter())
    const file = new File([raw], 'backup.json', { type: 'application/json' })

    await userEvent.upload(
      screen.getByLabelText('バックアップファイルを選択'),
      file,
    )

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(reloadMock).not.toHaveBeenCalled()
  })

  it('shows a write-error message and does not reload when applying the backup fails', async () => {
    const reloadMock = mockLocationReload()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    renderWithContext()
    const raw = buildValidBackupRaw(storeWithCharacter())
    const file = new File([raw], 'backup.json', { type: 'application/json' })

    await userEvent.upload(
      screen.getByLabelText('バックアップファイルを選択'),
      file,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      SAVE_ERROR_MESSAGE,
    )
    expect(reloadMock).not.toHaveBeenCalled()
  })

  it('shows a too-large error message without reading an oversized file', async () => {
    const reloadMock = mockLocationReload()
    const textSpy = vi.spyOn(File.prototype, 'text')
    renderWithContext()
    const file = new File(['dummy'], 'backup.json', {
      type: 'application/json',
    })
    Object.defineProperty(file, 'size', { value: 6 * 1024 * 1024 })

    await userEvent.upload(
      screen.getByLabelText('バックアップファイルを選択'),
      file,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      FILE_TOO_LARGE_MESSAGE,
    )
    expect(textSpy).not.toHaveBeenCalled()
    expect(reloadMock).not.toHaveBeenCalled()
  })

  it('shows a file-read error message when reading the selected file fails', async () => {
    const reloadMock = mockLocationReload()
    vi.spyOn(File.prototype, 'text').mockRejectedValue(new Error('read failed'))
    renderWithContext()
    const file = new File(['dummy'], 'backup.json', {
      type: 'application/json',
    })

    await userEvent.upload(
      screen.getByLabelText('バックアップファイルを選択'),
      file,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      FILE_READ_ERROR_MESSAGE,
    )
    expect(reloadMock).not.toHaveBeenCalled()
  })
})
