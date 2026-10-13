import { registerSW } from 'virtual:pwa-register'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
interface PwaState {
  offlineReady: boolean
  needRefresh: boolean
  installable: boolean
  installed: boolean
  error: string | null
}
let state: PwaState = {
  offlineReady: Boolean(navigator.serviceWorker?.controller),
  needRefresh: false,
  installable: false,
  installed: window.matchMedia('(display-mode: standalone)').matches,
  error: null,
}
let prompt: InstallPrompt | null = null
const listeners = new Set<() => void>()
function update(changes: Partial<PwaState>) {
  state = { ...state, ...changes }
  for (const listener of listeners) listener()
}

const updateWorker = registerSW({
  immediate: true,
  onOfflineReady: () => update({ offlineReady: true }),
  onNeedRefresh: () => update({ needRefresh: true }),
  onRegisterError: () =>
    update({
      error:
        'Не вдалося підготувати офлайн-запуск. Перезавантаж застосунок із доступною мережею.',
    }),
})
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  prompt = event as InstallPrompt
  update({ installable: true })
})
window.addEventListener('appinstalled', () => {
  prompt = null
  update({ installed: true, installable: false })
})

export const pwa = {
  getSnapshot: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  update: () => updateWorker(true),
  dismissUpdate: () => update({ needRefresh: false }),
  install: async () => {
    if (!prompt) return
    const event = prompt
    prompt = null
    update({ installable: false })
    await event.prompt()
    await event.userChoice
  },
}
