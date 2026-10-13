import { describe, expect, it, vi } from 'vitest'
import { handleApi, type ApiDependencies } from './api'

const key = 'testing-personal-workspace-key'
const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test',
  keys: {
    auth: Buffer.alloc(16).toString('base64url'),
    p256dh: Buffer.alloc(65).toString('base64url'),
  },
}
describe('push subscription API', () => {
  it('requires workspace authorization before saving or deleting subscriptions', async () => {
    const save = vi.fn(async () => {})
    const remove = vi.fn(async () => {})
    const dependencies: ApiDependencies = {
      config: {
        syncEnabled: true,
        pushEnabled: true,
        pushPublicKey: 'public',
        spaceId: 'space',
      },
      syncKey: key,
      sync: async () => [],
      push: { save, remove },
    }
    const request = (method: string, data: unknown, authorized = true) =>
      new Request('http://localhost/api/push/subscription', {
        method,
        headers: authorized ? { authorization: `Bearer ${key}` } : {},
        body: JSON.stringify(data),
      })
    expect(
      (
        await handleApi(
          request(
            'POST',
            { subscription, timezone: 'Europe/Kyiv', time: '09:00' },
            false,
          ),
          dependencies,
        )
      ).status,
    ).toBe(401)
    expect(save).not.toHaveBeenCalled()
    expect(
      (
        await handleApi(
          request('POST', {
            subscription,
            timezone: 'Europe/Kyiv',
            time: '09:00',
          }),
          dependencies,
        )
      ).status,
    ).toBe(200)
    expect(save).toHaveBeenCalledTimes(1)
    expect(
      (
        await handleApi(
          request('DELETE', { endpoint: subscription.endpoint }),
          dependencies,
        )
      ).status,
    ).toBe(200)
    expect(remove).toHaveBeenCalledWith(subscription.endpoint)
  })
})
