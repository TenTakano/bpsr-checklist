import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { StoreContext, type StoreStatus } from './context'
import {
  backupCorruptedStore,
  createEmptyStore,
  loadStore,
  saveStore,
} from './persistence'
import { reducer } from './reducer'
import type { Store } from './types'

interface InitialState {
  store: Store
  status: StoreStatus
  message: string | null
  corruptedRaw?: string
}

export const RECOVERED_MESSAGE =
  'データが壊れていたため、元のデータをバックアップに退避し、空の状態で起動しました。'
export const READONLY_MESSAGE =
  'データの保存領域に問題があるため、読み取り専用モードで起動しました。変更は保存されません。'
export const SAVE_ERROR_MESSAGE =
  'データの保存に失敗しました。ブラウザの空き容量を確認してください。'

const resolveInitialState = (): InitialState => {
  const result = loadStore()
  switch (result.status) {
    case 'ok':
      return { store: result.store, status: 'ok', message: null }
    case 'recovered':
      return {
        store: result.store,
        status: 'recovered',
        message: RECOVERED_MESSAGE,
        corruptedRaw: result.corruptedRaw,
      }
    case 'readonly':
      return {
        store: createEmptyStore(),
        status: 'readonly',
        message: READONLY_MESSAGE,
      }
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(resolveInitialState)
  const [store, dispatch] = useReducer(reducer, initial.store)
  const [status, setStatus] = useState(initial.status)
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null)
  const backedUpRef = useRef(false)

  useEffect(() => {
    if (status === 'readonly') {
      return
    }

    if (!backedUpRef.current && initial.corruptedRaw !== undefined) {
      backedUpRef.current = true
      const backupResult = backupCorruptedStore(initial.corruptedRaw)
      if (backupResult.status === 'error') {
        // react-hooks/set-state-in-effect forbids synchronous setState here,
        // so defer it to a microtask.
        queueMicrotask(() => {
          setStatus('readonly')
          setOverrideMessage(READONLY_MESSAGE)
        })
        return
      }
    }

    const saveResult = saveStore(store)
    // react-hooks/set-state-in-effect forbids synchronous setState here,
    // so defer it to a microtask.
    queueMicrotask(() => {
      setOverrideMessage(saveResult.status === 'ok' ? null : SAVE_ERROR_MESSAGE)
    })
  }, [store, status, initial.corruptedRaw])

  const guardedDispatch = useMemo(() => {
    if (status === 'readonly') {
      return () => {}
    }
    return dispatch
  }, [status])

  const message = overrideMessage ?? initial.message

  const value = useMemo(
    () => ({
      store,
      status,
      message,
      dispatch: guardedDispatch,
    }),
    [store, status, message, guardedDispatch],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
