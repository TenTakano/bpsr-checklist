import { createContext, useContext } from 'react'
import type { Action } from './actions'
import type { Store } from './types'

export type StoreStatus = 'ok' | 'recovered' | 'readonly'

export interface StoreContextValue {
  store: Store
  status: StoreStatus
  message: string | null
  dispatch: (action: Action) => void
}

export const StoreContext = createContext<StoreContextValue | null>(null)

export const useStore = (): StoreContextValue => {
  const context = useContext(StoreContext)
  if (context === null) {
    throw new Error('useStore は StoreProvider の内側で使用してください')
  }
  return context
}
