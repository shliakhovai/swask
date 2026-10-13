import { useSyncExternalStore } from 'react'
import { REMINDER_KEY, ReminderStore } from '../lib/reminder-store'
import { today } from '../lib/date'

export const reminderStore = new ReminderStore({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
})
window.addEventListener('storage', (event) => {
  if (event.key === REMINDER_KEY || event.key === null) reminderStore.refresh()
})
export function useReminders() {
  return useSyncExternalStore(
    reminderStore.subscribe,
    reminderStore.getSnapshot,
  )
}
function moment() {
  const now = new Date()
  return `${today(now)}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
}
function subscribe(listener: () => void) {
  const timer = setInterval(listener, 30_000)
  window.addEventListener('focus', listener)
  document.addEventListener('visibilitychange', listener)
  return () => {
    clearInterval(timer)
    window.removeEventListener('focus', listener)
    document.removeEventListener('visibilitychange', listener)
  }
}
export function useMinute() {
  return useSyncExternalStore(subscribe, moment)
}
