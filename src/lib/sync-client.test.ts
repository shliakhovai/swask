import { describe, expect, it } from 'vitest'
import { SyncClient } from './sync-client'
import { TaskStore, type TaskStorage } from './task-store'
import { applyOperation, type Task, type TaskOperation } from './tasks'

function storage(): TaskStorage {
  const values = new Map<string, string>()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
  }
}
const config = {
  syncEnabled: true,
  spaceId: 'space-one',
  pushEnabled: false,
  pushPublicKey: null,
}
const key = 'test-key-for-devices-12345'
const draft = {
  title: 'Offline first',
  description: '',
  deadline: null,
  link: '',
}
function cloud() {
  let tasks: Task[] = []
  const receipts = new Set<string>()
  const fetcher: typeof fetch = async (input, init) => {
    if (String(input) === '/api/config') return Response.json(config)
    const operations: TaskOperation[] = JSON.parse(
      String(init?.body),
    ).operations
    for (const operation of operations) {
      if (!receipts.has(operation.id)) {
        tasks = applyOperation(tasks, operation)
        receipts.add(operation.id)
      }
    }
    return Response.json({
      tasks,
      acknowledged: operations.map((operation) => operation.id),
      spaceId: config.spaceId,
    })
  }
  return { fetcher, getTasks: () => tasks }
}
describe('device synchronization', () => {
  it('calls fetch as a function without binding it to the sync client', async () => {
    const saved = storage()
    const fetcher: typeof fetch = async function (this: unknown) {
      expect(this).toBeUndefined()
      return Response.json(config)
    }
    const client = new SyncClient(new TaskStore(saved), saved, fetcher)
    await client.initialize()
    expect(client.getSnapshot().config).toEqual(config)
  })
  it('uploads offline edits and fetches the same tasks on a second device', async () => {
    const server = cloud()
    const localA = storage()
    const localB = storage()
    const tasksA = new TaskStore(localA)
    const tasksB = new TaskStore(localB)
    tasksA.create(draft)
    const clientA = new SyncClient(tasksA, localA, server.fetcher)
    const clientB = new SyncClient(tasksB, localB, server.fetcher)
    await clientA.initialize()
    await clientB.initialize()
    expect(await clientA.connect(key)).toBe(true)
    expect(await clientB.connect(key)).toBe(true)
    expect(tasksB.getSnapshot().document.tasks[0]?.title).toBe('Offline first')
    expect(tasksA.getSnapshot().document.pending).toHaveLength(0)
  })
  it('preserves edits made while a request is in flight and sends them next', async () => {
    const server = cloud()
    const saved = storage()
    const store = new TaskStore(saved)
    const task = store.create(draft)!
    let edited = false
    const fetcher: typeof fetch = async (input, init) => {
      const result = await server.fetcher(input, init)
      if (String(input) === '/api/sync' && !edited) {
        edited = true
        store.update(task.id, { title: 'Changed during request' })
      }
      return result
    }
    const client = new SyncClient(store, saved, fetcher)
    await client.initialize()
    await client.connect(key)
    expect(store.getSnapshot().document.tasks[0]?.title).toBe(
      'Changed during request',
    )
    expect(server.getTasks()[0]?.title).toBe('Changed during request')
    expect(store.getSnapshot().document.pending).toHaveLength(0)
  })
  it('retains pending operations on network failure or invalid acknowledgments', async () => {
    for (const invalid of [false, true]) {
      const saved = storage()
      const store = new TaskStore(saved)
      store.create(draft)
      const fetcher: typeof fetch = async (input) => {
        if (String(input) === '/api/config') return Response.json(config)
        if (!invalid) throw new TypeError('offline')
        return Response.json({
          tasks: [],
          acknowledged: [],
          spaceId: config.spaceId,
        })
      }
      const client = new SyncClient(store, saved, fetcher)
      await client.initialize()
      expect(await client.connect(key)).toBe(false)
      expect(store.getSnapshot().document.pending).toHaveLength(1)
      expect(store.getSnapshot().document.tasks[0]?.title).toBe('Offline first')
    }
  })
  it('does not upload into a different cloud workspace', async () => {
    const saved = storage()
    const store = new TaskStore(saved)
    store.create(draft)
    store.acceptRemote([], [], 'old-space')
    const server = cloud()
    const client = new SyncClient(store, saved, server.fetcher)
    await client.initialize()
    expect(await client.connect(key)).toBe(false)
    expect(server.getTasks()).toHaveLength(0)
  })
})
