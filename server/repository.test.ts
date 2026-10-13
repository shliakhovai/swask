import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { sample } from '../tests/fixtures/task'
import { type TaskOperation } from '../src/lib/tasks'
import { TASK_MIGRATION } from './migrations'
import { TaskRepository } from './repository'

const database = new PGlite()
const repository = new TaskRepository({
  query: async (text, parameters) =>
    (await database.query<Record<string, unknown>>(text, parameters)).rows,
})
const operation = (
  kind: 'create' | 'update' | 'delete',
  changes = {},
): TaskOperation =>
  kind === 'create'
    ? {
        id: crypto.randomUUID(),
        kind,
        taskId: sample.id,
        task: sample,
        at: sample.updatedAt,
      }
    : kind === 'delete'
      ? {
          id: crypto.randomUUID(),
          kind,
          taskId: sample.id,
          at: sample.updatedAt,
        }
      : {
          id: crypto.randomUUID(),
          kind,
          taskId: sample.id,
          at: sample.updatedAt,
          changes,
        }
beforeAll(async () => {
  for (const statement of TASK_MIGRATION) await database.exec(statement)
}, 30_000)
beforeEach(async () => {
  await database.exec('DELETE FROM swask_tasks; DELETE FROM swask_operations;')
})
afterAll(async () => {
  await database.close()
})
describe('PostgreSQL sync migration', () => {
  it('creates an idempotent snapshot and accepts retries exactly once', async () => {
    const create = operation('create')
    expect(await repository.sync([create])).toHaveLength(1)
    const first = await repository.sync([
      operation('update', { title: 'New title' }),
    ])
    const retry = await repository.sync([create])
    expect(retry).toEqual(first)
    expect(retry[0]?.title).toBe('New title')
  })
  it('merges changes to different fields in server receipt order', async () => {
    await repository.sync([operation('create')])
    await repository.sync([operation('update', { title: 'From laptop' })])
    const tasks = await repository.sync([
      operation('update', { description: 'From phone', completed: true }),
    ])
    expect(tasks[0]).toMatchObject({
      title: 'From laptop',
      description: 'From phone',
      completed: true,
    })
  })
  it('keeps tombstones when a stale edit or create arrives', async () => {
    await repository.sync([operation('create')])
    await repository.sync([operation('delete')])
    const tasks = await repository.sync([
      operation('update', { title: 'Stale' }),
      operation('create'),
    ])
    expect(tasks[0]).toMatchObject({ title: 'Read', deleted: true })
  })
  it('reruns migrations without dropping data', async () => {
    await repository.sync([operation('create')])
    for (const statement of TASK_MIGRATION) await database.exec(statement)
    expect(await repository.sync([])).toHaveLength(1)
  })
  it('rolls back an entire malformed SQL batch', async () => {
    const create = operation('create')
    await expect(
      database.query('SELECT swask_apply_operations($1::jsonb)', [
        JSON.stringify([
          create,
          { id: crypto.randomUUID(), taskId: sample.id, kind: 'unknown' },
        ]),
      ]),
    ).rejects.toThrow()
    expect(await repository.sync([])).toHaveLength(0)
    expect(await repository.sync([create])).toHaveLength(1)
  })
})
