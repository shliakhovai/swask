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
let updateRequested = false
let reloading = false
function reloadRequestedUpdate() {
  if (!updateRequested || reloading) return
  reloading = true
  window.location.reload()
}
function update(changes: Partial<PwaState>) {
  state = { ...state, ...changes }
  for (const listener of listeners) listener()
}

const updateWorker = registerSW({
  immediate: true,
  onNeedReload: reloadRequestedUpdate,
  onOfflineReady: () => update({ offlineReady: true }),
  onNeedRefresh: () => update({ needRefresh: true }),
  onRegisterError: () =>
    update({
      error:
        'Не вдалося підготувати офлайн-запуск. Перезавантаж застосунок із доступною мережею.',
    }),
})
navigator.serviceWorker?.addEventListener(
  'controllerchange',
  reloadRequestedUpdate,
)
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
  update: async () => {
    const registration = await navigator.serviceWorker?.getRegistration()
    updateRequested = true
    if (!registration?.waiting) {
      reloadRequestedUpdate()
      return
    }
    try {
      await updateWorker(true)
    } catch {
      updateRequested = false
      update({
        error:
          'Не вдалося оновити swask. Спробуй ще раз після перезавантаження.',
      })
    }
  },
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
