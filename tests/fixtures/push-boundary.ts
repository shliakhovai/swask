import type { Page } from '@playwright/test'
import { pwaUpdateServer } from './pwa-update-server'

export const pushSpace = 'e2e-push-space'
export const pushKey = 'e2e-local-push-workspace-key'
export interface PushProbe {
  active: boolean
  permissionRequests: number
  unsubscribes: number
}

// Mock native permission/subscription APIs and model cloud responses on an
// isolated HTTP origin. Keep app state, storage and the production worker real.
export async function installPushBoundary(
  page: Page,
  options: {
    permission: NotificationPermission
    existing: boolean
    storageFails?: boolean
  },
  upstream: string,
) {
  await page.addInitScript(
    (seed) => {
      const probe: PushProbe = {
        active: seed.existing,
        permissionRequests: 0,
        unsubscribes: 0,
      }
      Object.defineProperty(window, 'swaskPushProbe', { value: probe })
      const data = {
        endpoint: 'https://fcm.googleapis.com/fcm/send/e2e',
        keys: { auth: btoa('a'.repeat(16)), p256dh: btoa('p'.repeat(65)) },
      }
      const handle = {
        endpoint: data.endpoint,
        toJSON: () => data,
        unsubscribe: async () => {
          probe.active = false
          probe.unsubscribes++
          return true
        },
      }
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: {
          permission: seed.permission,
          requestPermission: async () => {
            probe.permissionRequests++
            return seed.permission
          },
        },
      })
      if (!('PushManager' in window))
        Object.defineProperty(window, 'PushManager', {
          value: function PushManager() {},
        })
      Object.defineProperty(
        ServiceWorkerRegistration.prototype,
        'pushManager',
        {
          configurable: true,
          get: () => ({
            getSubscription: async () => (probe.active ? handle : null),
            subscribe: async () => {
              probe.active = true
              return handle
            },
          }),
        },
      )
      localStorage.setItem('swask.sync.key.v1', seed.key)
      localStorage.setItem(
        'swask.tasks.v1',
        JSON.stringify({
          version: 1,
          tasks: [],
          pending: [],
          scope: seed.space,
        }),
      )
      localStorage.setItem(
        'swask.reminders.v1',
        JSON.stringify({
          version: 1,
          inApp: true,
          push: seed.existing,
          time: '09:00',
          dismissedDate: null,
        }),
      )
      if (seed.storageFails) {
        const original = Storage.prototype.setItem
        Storage.prototype.setItem = function (key, value) {
          if (key === 'swask.reminders.v1')
            throw new DOMException('quota', 'QuotaExceededError')
          return original.call(this, key, value)
        }
      }
    },
    { ...options, key: pushKey, space: pushSpace },
  )
  const calls: { method: string; spaceId: string }[] = []
  const server = await pwaUpdateServer(upstream, async (request) => {
    const path = new URL(request.url).pathname
    if (path === '/api/config') {
      return Response.json({
        syncEnabled: true,
        spaceId: pushSpace,
        pushEnabled: true,
        pushPublicKey: 'B' + 'A'.repeat(86),
      })
    }
    const data = (await request.json()) as {
      spaceId: string
      operations?: { id: string }[]
    }
    if (
      request.headers.get('authorization') !== `Bearer ${pushKey}` ||
      data.spaceId !== pushSpace
    ) {
      return Response.json({ error: 'Некоректний простір.' }, { status: 409 })
    }
    if (path === '/api/push/subscription') {
      calls.push({ method: request.method, spaceId: data.spaceId })
      return Response.json({ ok: true })
    } else {
      return Response.json({
        tasks: [],
        acknowledged: data.operations?.map((operation) => operation.id) ?? [],
        spaceId: pushSpace,
      })
    }
  })
  return { calls, ...server }
}
