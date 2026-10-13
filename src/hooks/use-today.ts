import { useSyncExternalStore } from 'react'
import { today } from '../lib/date'

function subscribe(listener: () => void) {
  const timer = window.setInterval(listener, 30_000)
  window.addEventListener('focus', listener)
  document.addEventListener('visibilitychange', listener)
  return () => {
    clearInterval(timer)
    window.removeEventListener('focus', listener)
    document.removeEventListener('visibilitychange', listener)
  }
}
export function useToday() {
  return useSyncExternalStore(subscribe, today)
}
