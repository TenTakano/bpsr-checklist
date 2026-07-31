import './App.css'
import { useRef, useState } from 'react'
import { useTheme } from './hooks/useTheme'
import { CharacterManagerModal } from './components/CharacterManagerModal'
import { StoreProvider } from './store/StoreProvider'

function App() {
  const { theme, toggleTheme } = useTheme()
  const [isCharacterManagerOpen, setIsCharacterManagerOpen] = useState(false)
  const openButtonRef = useRef<HTMLButtonElement>(null)

  const closeCharacterManager = () => {
    setIsCharacterManagerOpen(false)
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
              className="character-manager-toggle"
              onClick={() => setIsCharacterManagerOpen(true)}
              aria-label="キャラクター管理を開く"
            >
              キャラクター管理
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
        <main className="app-layout">
          <h1>BPSR Checklist</h1>
          <p>
            Blue Protocol: Star Resonance
            のデイリー/ウィークリータスク管理ツール
          </p>
        </main>
        {isCharacterManagerOpen && (
          <CharacterManagerModal onClose={closeCharacterManager} />
        )}
      </div>
    </StoreProvider>
  )
}

export default App
