import { describe, expect, it, vi } from 'vitest'
import { sample } from '../tests/fixtures/task'
import { ReminderWorker } from './reminder-worker'
import { type ReminderRepository } from './push-repository'

const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/test',
  keys: {
    auth: Buffer.alloc(16).toString('base64url'),
    p256dh: Buffer.alloc(65).toString('base64url'),
  },
}
function setup() {
  const task = { ...sample, deadline: '2026-10-13' }
  const claims = new Set<string>()
  const repo: ReminderRepository = {
    subscriptions: vi.fn(async () => [
      { id: 'device', subscription, timezone: 'Europe/Kyiv', time: '09:00' },
    ]),
    tasks: vi.fn(async () => [task]),
    reserve: vi.fn(async (id, task) => {
      const key = `${id}/${task.id}/${task.deadline}`
      if (claims.has(key)) return 'settled' as const
      claims.add(key)
      return 'claimed' as const
    }),
    delivered: vi.fn(async () => {}),
    retry: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  }
  return { repo, task, send: vi.fn(async () => {}) }
}
describe('background reminders', () => {
  it('keeps retrying a pending delivery after its lease expires', async () => {
    const { repo } = setup()
    const reserve = vi
      .fn<ReminderRepository['reserve']>()
      .mockResolvedValueOnce('claimed')
      .mockResolvedValueOnce('waiting')
      .mockResolvedValueOnce('claimed')
    repo.reserve = reserve
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue(undefined)
    const worker = new ReminderWorker(repo, send)
    await worker.tick(new Date('2026-10-13T06:00:00Z'))
    await worker.tick(new Date('2026-10-13T06:01:00Z'))
    await worker.tick(new Date('2026-10-13T06:06:00Z'))
    expect(send).toHaveBeenCalledTimes(2)
    expect(repo.delivered).toHaveBeenCalledTimes(1)
  })
  it('waits for the local reminder time and avoids repeated database polling', async () => {
    const { repo, send } = setup()
    const worker = new ReminderWorker(repo, send)
    await worker.tick(new Date('2026-10-13T05:00:00Z'))
    await worker.tick(new Date('2026-10-13T05:59:00Z'))
    expect(repo.subscriptions).toHaveBeenCalledTimes(1)
    expect(repo.tasks).not.toHaveBeenCalled()
    await worker.tick(new Date('2026-10-13T06:00:00Z'))
    await worker.tick(new Date('2026-10-13T07:00:00Z'))
    expect(send).toHaveBeenCalledTimes(1)
    expect(repo.tasks).toHaveBeenCalledTimes(1)
  })
  it('preserves invalidation when a task changes during push delivery', async () => {
    const { repo, send } = setup()
    const worker = new ReminderWorker(repo, send)
    send.mockImplementationOnce(async () => {
      worker.invalidate()
    })
    await worker.tick(new Date('2026-10-13T06:00:00Z'))
    await worker.tick(new Date('2026-10-13T06:01:00Z'))
    expect(repo.tasks).toHaveBeenCalledTimes(2)
    expect(send).toHaveBeenCalledTimes(1)
  })
  it('removes an expired subscription and retries transient failures', async () => {
    for (const expired of [false, true]) {
      const { repo } = setup()
      const sender = vi.fn(async () => {
        throw expired ? { statusCode: 410 } : new Error('timeout')
      })
      await new ReminderWorker(repo, sender).tick(
        new Date('2026-10-13T06:00:00Z'),
      )
      expect(repo.delivered).not.toHaveBeenCalled()
      if (expired) expect(repo.remove).toHaveBeenCalledWith('device')
      else expect(repo.retry).toHaveBeenCalledTimes(1)
    }
  })
  it('suppresses completed, deleted and postponed tasks', async () => {
    const { repo, task, send } = setup()
    repo.tasks = async () => [
      { ...task, completed: true },
      { ...task, deleted: true },
      { ...task, deadline: '2026-10-14' },
    ]
    await new ReminderWorker(repo, send).tick(new Date('2026-10-13T06:00:00Z'))
    expect(send).not.toHaveBeenCalled()
  })
})
