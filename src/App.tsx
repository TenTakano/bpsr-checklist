import './App.css'
import { CharacterManager } from './components/CharacterManager'
import { MatrixView } from './components/MatrixView'
import { StoreProvider } from './store/StoreProvider'

function App() {
  return (
    <StoreProvider>
      <main className="app-layout">
        <header className="app-intro">
          <h1>BPSR Checklist</h1>
          <p>
            Blue Protocol: Star Resonance
            のデイリー/ウィークリータスク管理ツール
          </p>
        </header>
        <MatrixView />
        <CharacterManager />
      </main>
    </StoreProvider>
  )
}

export default App
