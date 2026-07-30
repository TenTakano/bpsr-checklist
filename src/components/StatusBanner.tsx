import { useStore } from '../store/context'

export function StatusBanner() {
  const { message } = useStore()

  if (message === null) {
    return null
  }

  return (
    <p role="status" className="status-banner">
      {message}
    </p>
  )
}
