import './App.css'
import { useRef, useState } from 'react'
import type { TaskCategory } from './data/taskLookup'
import { useTheme } from './hooks/useTheme'
import { SettingsModal } from './components/SettingsModal'
import { StatusBanner } from './components/StatusBanner'
import { SummaryPanel } from './components/SummaryPanel'
import { MatrixView } from './components/MatrixView'
import { StoreProvider } from './store/StoreProvider'

function App() {
  const { theme, toggleTheme } = useTheme()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsFocusSection, setSettingsFocusSection] =
    useState<TaskCategory | null>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const settingsToggleRef = useRef<HTMLButtonElement | null>(null)

  const openSettings = (trigger: HTMLElement) => {
    triggerRef.current = trigger
    setSettingsFocusSection(null)
    setIsSettingsOpen(true)
  }

  const openTaskVisibility = (section: TaskCategory, trigger: HTMLElement) => {
    triggerRef.current = trigger
    setSettingsFocusSection(section)
    setIsSettingsOpen(true)
  }

  const closeSettings = () => {
    setIsSettingsOpen(false)
    const trigger = triggerRef.current
    const focusTarget =
      trigger !== null && trigger.isConnected
        ? trigger
        : settingsToggleRef.current
    focusTarget?.focus()
  }

  return (
    <StoreProvider>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-titles">
            <h1>BPSR Checklist</h1>
            <p className="app-header-subtitle">
              Blue Protocol: Star Resonance デイリー/ウィークリータスク管理
            </p>
          </div>
          <div className="app-header-actions">
            <button
              type="button"
              className="icon-toggle theme-toggle"
              onClick={toggleTheme}
              aria-label={
                theme === 'dark'
                  ? 'ライトモードに切り替え'
                  : 'ダークモードに切り替え'
              }
            >
              {theme === 'dark' ? '☀' : '🌙'}
            </button>
            <button
              type="button"
              ref={settingsToggleRef}
              className="icon-toggle settings-toggle"
              onClick={(event) => openSettings(event.currentTarget)}
              aria-label="設定を開く"
            >
              ⚙
            </button>
          </div>
        </header>
        <main className="app-layout">
          <StatusBanner />
          <SummaryPanel />
          <MatrixView onOpenTaskVisibility={openTaskVisibility} />
        </main>
        {isSettingsOpen && (
          <SettingsModal
            onClose={closeSettings}
            initialFocusSection={settingsFocusSection}
          />
        )}
      </div>
    </StoreProvider>
  )
}

export default App
