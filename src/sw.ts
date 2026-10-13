/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { pushMessage } from './lib/push-message'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//],
  }),
)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
self.addEventListener('push', (event) => {
  let value: unknown = null
  try {
    value = event.data?.json()
  } catch {
    /* Show a generic reminder for an invalid payload. */
  }
  const payload = pushMessage(value)
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    }),
  )
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      )
      if (existing) {
        await existing.focus()
        existing.postMessage({ type: 'OPEN_TASKS' })
        return
      }
      await self.clients.openWindow('/')
    })(),
  )
})
