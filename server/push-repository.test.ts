import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sample } from '../tests/fixtures/task'
import { TASK_MIGRATION } from './migrations'
import { PUSH_MIGRATION } from './push-migrations'
import { PushRepository, subscriptionId } from './push-repository'
import { TaskRepository } from './repository'
import { parsePushPreferences } from './push-protocol'

const postgres = new PGlite()
const database = {
  query: async (text: string, parameters?: unknown[]) =>
    (await postgres.query<Record<string, unknown>>(text, parameters)).rows,
}
const push = new PushRepository(database)
const tasks = new TaskRepository(database)
const preferences = {
  subscription: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/test',
    keys: {
      auth: Buffer.alloc(16).toString('base64url'),
      p256dh: Buffer.alloc(65).toString('base64url'),
    },
  },
  time: '09:00',
  timezone: 'Europe/Kyiv',
}
beforeAll(async () => {
  for (const statement of [...TASK_MIGRATION, ...PUSH_MIGRATION])
    await postgres.exec(statement)
}, 30_000)
beforeEach(async () => {
  await postgres.exec(
    'DELETE FROM swask_push_subscriptions; DELETE FROM swask_tasks; DELETE FROM swask_operations;',
  )
})
afterAll(async () => {
  await postgres.close()
})
describe('push delivery persistence', () => {
  it('validates endpoint providers, keys and time zones', () => {
    expect(parsePushPreferences(preferences)).toEqual(preferences)
    expect(() =>
      parsePushPreferences({ ...preferences, timezone: 'not-a-zone' }),
    ).toThrow()
    expect(() =>
      parsePushPreferences({
        ...preferences,
        subscription: {
          ...preferences.subscription,
          endpoint: 'https://127.0.0.1/private',
        },
      }),
    ).toThrow()
  })
  it('reserves each task deadline once and prevents claims for completed tasks', async () => {
    await push.upsert(preferences)
    const task = { ...sample, deadline: new Date().toISOString().slice(0, 10) }
    await tasks.sync([
      {
        id: crypto.randomUUID(),
        taskId: task.id,
        at: task.updatedAt,
        kind: 'create',
        task,
      },
    ])
    const id = subscriptionId(preferences.subscription.endpoint)
    const claimed = await Promise.all([
      push.reserve(id, task),
      push.reserve(id, task),
    ])
    expect(claimed.sort()).toEqual(['claimed', 'waiting'])
    await push.release(id, task)
    expect(await push.reserve(id, task)).toBe('claimed')
    await push.delivered(id, task)
    await push.release(id, task)
    expect(await push.reserve(id, task)).toBe('settled')
    await tasks.sync([
      {
        id: crypto.randomUUID(),
        taskId: task.id,
        at: task.updatedAt,
        kind: 'update',
        changes: { completed: true },
      },
    ])
    await postgres.exec('DELETE FROM swask_push_deliveries')
    expect(await push.reserve(id, task)).toBe('settled')
  })
  it('reclaims expired retry leases and cascades deletion of expired subscriptions', async () => {
    await push.upsert(preferences)
    await tasks.sync([
      {
        id: crypto.randomUUID(),
        taskId: sample.id,
        at: sample.updatedAt,
        kind: 'create',
        task: sample,
      },
    ])
    const id = subscriptionId(preferences.subscription.endpoint)
    expect(await push.reserve(id, sample)).toBe('claimed')
    await push.retry(id, sample)
    expect(await push.reserve(id, sample)).toBe('waiting')
    await postgres.exec(
      "UPDATE swask_push_deliveries SET locked_until = now() - interval '1 minute'",
    )
    expect(await push.reserve(id, sample)).toBe('claimed')
    await push.remove(id)
    expect(await push.subscriptions()).toHaveLength(0)
    expect(
      (await postgres.query('SELECT * FROM swask_push_deliveries')).rows,
    ).toHaveLength(0)
  })
})
