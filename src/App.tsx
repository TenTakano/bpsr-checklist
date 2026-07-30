import './App.css'
import { useTheme } from './hooks/useTheme'

function App() {
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-actions">
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
          Blue Protocol: Star Resonance のデイリー/ウィークリータスク管理ツール
        </p>
      </main>
    </div>
  )
}

export default App
