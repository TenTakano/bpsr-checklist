import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { evaluateReset } from './actions'
import { StoreContext, type StoreStatus } from './context'
import {
  backupCorruptedStore,
  backupResetSnapshot,
  createInitialStore,
  diffRemovedProgress,
  loadStore,
  saveStore,
} from './persistence'
import { evaluateResetState, reducer } from './reducer'
import type { Store } from './types'

export const RESET_EVALUATION_INTERVAL_MS = 60_000

interface InitialState {
  store: Store
  previousProgress: Store['progress']
  previousResetState: Store['resetState']
  status: StoreStatus
  message: string | null
  corruptedRaw?: string
}

export const RECOVERED_MESSAGE =
  'データが壊れていたため、元のデータをバックアップに退避し、デフォルトキャラクター1件の状態で起動しました。'
export const READONLY_MESSAGE =
  'データの保存領域に問題があるため、読み取り専用モードで起動しました。変更は保存されません。'
export const SAVE_ERROR_MESSAGE =
  'データの保存に失敗しました。ブラウザの空き容量を確認してください。'

const resolveInitialState = (): InitialState => {
  const result = loadStore()
  const now = new Date()
  switch (result.status) {
    case 'ok':
      return {
        store: evaluateResetState(result.store, now),
        previousProgress: result.store.progress,
        previousResetState: result.store.resetState,
        status: 'ok',
        message: null,
      }
    case 'recovered':
      return {
        store: evaluateResetState(result.store, now),
        previousProgress: result.store.progress,
        previousResetState: result.store.resetState,
        status: 'recovered',
        message: RECOVERED_MESSAGE,
        corruptedRaw: result.corruptedRaw,
      }
    case 'readonly': {
      const initial = createInitialStore()
      return {
        store: evaluateResetState(initial, now),
        previousProgress: initial.progress,
        previousResetState: initial.resetState,
        status: 'readonly',
        message: READONLY_MESSAGE,
      }
    }
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(resolveInitialState)
  const [store, dispatch] = useReducer(reducer, initial.store)
  const [status, setStatus] = useState(initial.status)
  const [overrideMessage, setOverrideMessage] = useState<string | null>(null)
  const backedUpRef = useRef(false)
  const previousProgressRef = useRef(initial.previousProgress)
  const previousResetStateRef = useRef(initial.previousResetState)

  // evaluateReset dispatches through the raw `dispatch`, bypassing
  // guardedDispatch, so the displayed store still reflects resets even while
  // readonly (only persistence is skipped, via the save effect below).
  useEffect(() => {
    const evaluate = () => dispatch(evaluateReset(new Date()))
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        evaluate()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    const intervalId = setInterval(evaluate, RESET_EVALUATION_INTERVAL_MS)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(intervalId)
    }
  }, [dispatch])

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

    const resetStateChanged = store.resetState !== previousResetStateRef.current
    const removedProgress = resetStateChanged
      ? diffRemovedProgress(previousProgressRef.current, store.progress)
      : {}
    previousResetStateRef.current = store.resetState
    previousProgressRef.current = store.progress

    if (Object.keys(removedProgress).length > 0) {
      const backupResult = backupResetSnapshot(removedProgress)
      if (backupResult.status === 'error') {
        // Backup failed: skip saving so localStorage keeps the pre-reset
        // state. The refs above already advanced, so later unrelated saves
        // are not blocked.
        queueMicrotask(() => {
          setOverrideMessage(SAVE_ERROR_MESSAGE)
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
