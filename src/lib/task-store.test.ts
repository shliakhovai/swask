import { describe, expect, it } from 'vitest'
import { TaskStore, STORAGE_KEY, type TaskStorage } from './task-store'

function memoryStorage(): TaskStorage {
  const data = new Map<string, string>()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}
const draft = {
  title: 'Plan',
  description: 'Details',
  deadline: null,
  link: '',
}
describe('local task storage', () => {
  it('persists creation, edits, completion and deletion across reloads', () => {
    const storage = memoryStorage()
    const store = new TaskStore(storage)
    const task = store.create(draft)!
    store.update(task.id, { title: 'New title', completed: true })
    expect(new TaskStore(storage).getSnapshot().document.tasks[0]?.title).toBe(
      'New title',
    )
    store.delete(task.id)
    expect(
      new TaskStore(storage).getSnapshot().document.tasks[0]?.deleted,
    ).toBe(true)
    expect(store.getSnapshot().document.pending).toHaveLength(3)
  })
  it('keeps the previous snapshot when storage rejects a write', () => {
    const store = new TaskStore({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(store.create(draft)).toBeNull()
    expect(store.getSnapshot().document.tasks).toHaveLength(0)
    expect(store.getSnapshot().error).toBeTruthy()
  })
  it('never silently overwrites unreadable data', () => {
    const storage = memoryStorage()
    storage.setItem(STORAGE_KEY, 'broken')
    const store = new TaskStore(storage)
    expect(store.getSnapshot().blocked).toBe(true)
    expect(store.create(draft)).toBeNull()
    expect(storage.getItem(STORAGE_KEY)).toBe('broken')
  })
  it('reads the latest saved state before editing from another tab', () => {
    const storage = memoryStorage()
    const tabA = new TaskStore(storage)
    const tabB = new TaskStore(storage)
    tabA.create(draft)
    tabB.create({ ...draft, title: 'Second tab' })
    expect(new TaskStore(storage).getSnapshot().document.tasks).toHaveLength(2)
  })
})
