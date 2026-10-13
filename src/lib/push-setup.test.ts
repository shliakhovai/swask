import { describe, expect, it, vi } from 'vitest'
import { savePushOptIn } from './push-setup'

function setup() {
  const subscription = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test',
    unsubscribe: vi.fn(async () => true),
  }
  const callbacks = {
    save: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    persist: vi.fn(() => false),
  }
  return { subscription, callbacks }
}
describe('push opt-in persistence', () => {
  it('keeps a successful opt-in without cleanup', async () => {
    const { subscription, callbacks } = setup()
    callbacks.persist.mockReturnValue(true)
    await savePushOptIn(subscription, false, callbacks)
    expect(callbacks.remove).not.toHaveBeenCalled()
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })
  it('compensates a persisted server subscription when a local write fails', async () => {
    for (const existing of [false, true]) {
      const { subscription, callbacks } = setup()
      await expect(
        savePushOptIn(subscription, existing, callbacks),
      ).rejects.toMatchObject({ keepSubscription: false })
      expect(callbacks.save).toHaveBeenCalledTimes(1)
      expect(callbacks.remove).toHaveBeenCalledTimes(1)
      expect(subscription.unsubscribe).toHaveBeenCalledTimes(1)
    }
  })
  it('keeps an actionable cleanup handle when compensating deletion fails', async () => {
    const { subscription, callbacks } = setup()
    callbacks.remove.mockRejectedValueOnce(new TypeError('offline'))
    await expect(
      savePushOptIn(subscription, false, callbacks),
    ).rejects.toMatchObject({
      keepSubscription: true,
      message: expect.stringContaining('Вимкнути push-нагадування'),
    })
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1)
  })
  it('preserves an existing subscription when the server rejects the opt-in', async () => {
    const { subscription, callbacks } = setup()
    callbacks.save.mockRejectedValueOnce(
      new Error('Перевір ключ твого простору.'),
    )
    await expect(
      savePushOptIn(subscription, true, callbacks),
    ).rejects.toMatchObject({ keepSubscription: true })
    expect(callbacks.persist).not.toHaveBeenCalled()
    expect(callbacks.remove).not.toHaveBeenCalled()
    expect(subscription.unsubscribe).not.toHaveBeenCalled()
  })
  it('unsubscribes a newly created browser endpoint when the server rejects it', async () => {
    const { subscription, callbacks } = setup()
    callbacks.save.mockRejectedValueOnce(new TypeError('network'))
    await expect(
      savePushOptIn(subscription, false, callbacks),
    ).rejects.toMatchObject({ keepSubscription: false })
    expect(subscription.unsubscribe).toHaveBeenCalledTimes(1)
    expect(callbacks.persist).not.toHaveBeenCalled()
  })
})
