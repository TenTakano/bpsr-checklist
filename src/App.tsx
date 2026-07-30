import './App.css'
import { useRef, useState } from 'react'
import { useTheme } from './hooks/useTheme'
import { SettingsModal } from './components/SettingsModal'
import { StatusBanner } from './components/StatusBanner'
import { MatrixView } from './components/MatrixView'
import { StoreProvider } from './store/StoreProvider'

function App() {
  const { theme, toggleTheme } = useTheme()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const openButtonRef = useRef<HTMLButtonElement>(null)

  const closeSettings = () => {
    setIsSettingsOpen(false)
    openButtonRef.current?.focus()
  }

  return (
    <StoreProvider>
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-actions">
            <button
              type="button"
              ref={openButtonRef}
              className="settings-toggle"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="設定を開く"
            >
              ⚙
            </button>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={
                theme === 'dark'
                  ? 'ライトモードに切り替え'
                  : 'ダークモードに切り替え'
              }
            >
              {theme === 'dark' ? '☀' : '🌙'}
            </button>
          </div>
        </header>
        <StatusBanner />
        <main className="app-layout">
          <header className="app-intro">
            <h1>BPSR Checklist</h1>
            <p>
              Blue Protocol: Star Resonance
              のデイリー/ウィークリータスク管理ツール
            </p>
          </header>
          <MatrixView />
        </main>
        {isSettingsOpen && <SettingsModal onClose={closeSettings} />}
      </div>
    </StoreProvider>
  )
}

export default App
