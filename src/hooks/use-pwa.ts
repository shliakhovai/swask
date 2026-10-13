import { useSyncExternalStore } from 'react'
import { pwa } from '../lib/pwa'
export function usePwa() {
  return useSyncExternalStore(pwa.subscribe, pwa.getSnapshot)
}
