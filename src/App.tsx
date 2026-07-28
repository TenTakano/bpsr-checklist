import './App.css'
import { CharacterManager } from './components/CharacterManager'
import { StoreProvider } from './store/StoreProvider'

function App() {
  return (
    <StoreProvider>
      <main className="app-layout">
        <h1>BPSR Checklist</h1>
        <p>
          Blue Protocol: Star Resonance のデイリー/ウィークリータスク管理ツール
        </p>
        <CharacterManager />
      </main>
    </StoreProvider>
  )
}

export default App
