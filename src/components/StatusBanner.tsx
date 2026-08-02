import { useStore } from '../store/context'

export function StatusBanner() {
  const { message } = useStore()

  if (message === null) {
    return null
  }

  return (
    <div role="alert" className="status-banner">
      <span aria-hidden="true">⚠</span>
      <span>{message}</span>
    </div>
  )
}
