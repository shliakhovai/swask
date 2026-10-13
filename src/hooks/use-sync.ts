import { useEffect, useSyncExternalStore } from 'react'
import { SyncClient } from '../lib/sync-client'
import { taskStore } from './use-tasks'

export const syncClient = new SyncClient(taskStore, {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
})
export function useSync() {
  return useSyncExternalStore(syncClient.subscribe, syncClient.getSnapshot)
}
export function useSyncLifecycle() {
  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | undefined
    let active = true
    const sync = () => {
      if (navigator.onLine && document.visibilityState === 'visible')
        void syncClient.sync()
      else if (!navigator.onLine) syncClient.offline()
    }
    const initialize = () => {
      void syncClient.initialize().then(() => {
        if (active) sync()
      })
    }
    initialize()
    const unsubscribe = taskStore.subscribe(() => {
      if (taskStore.getSnapshot().document.pending.length === 0) return
      clearTimeout(debounce)
      debounce = setTimeout(sync, 250)
    })
    const interval = setInterval(() => {
      if (!syncClient.getSnapshot().config) initialize()
      else sync()
    }, 30_000)
    window.addEventListener('online', initialize)
    window.addEventListener('offline', sync)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      active = false
      clearInterval(interval)
      clearTimeout(debounce)
      unsubscribe()
      window.removeEventListener('online', initialize)
      window.removeEventListener('offline', sync)
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])
}
