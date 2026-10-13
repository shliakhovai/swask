import { useSyncExternalStore } from 'react'
import { STORAGE_KEY, TaskStore } from '../lib/task-store'

export const taskStore = new TaskStore({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
})
window.addEventListener('storage', (event) => {
  if (event.key === STORAGE_KEY || event.key === null) taskStore.refresh()
})
export function useTasks() {
  return useSyncExternalStore(taskStore.subscribe, taskStore.getSnapshot)
}
