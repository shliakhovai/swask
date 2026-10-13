import { describe, expect, it } from 'vitest'
import { REMINDER_KEY, ReminderStore } from './reminder-store'

function memory() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}
describe('reminder storage recovery', () => {
  it('preserves unreadable preferences until an explicit reset', () => {
    for (const raw of ['', 'broken', '{"version":2}']) {
      const storage = memory()
      storage.setItem(REMINDER_KEY, raw)
      const store = new ReminderStore(storage)
      expect(store.getSnapshot().blocked).toBe(true)
      expect(store.update({ inApp: false })).toBe(false)
      expect(store.rawData()).toBe(raw)
      expect(store.reset()).toBe(true)
      expect(store.getSnapshot().blocked).toBe(false)
      expect(new ReminderStore(storage).getSnapshot().preferences.time).toBe(
        '09:00',
      )
    }
  })
  it('merges a change against the most recent preferences from another tab', () => {
    const storage = memory()
    const first = new ReminderStore(storage)
    const second = new ReminderStore(storage)
    first.update({ time: '10:30' })
    second.update({ inApp: false })
    expect(new ReminderStore(storage).getSnapshot().preferences).toMatchObject({
      time: '10:30',
      inApp: false,
    })
  })
  it('keeps the last readable preferences if another tab corrupts storage', () => {
    const storage = memory()
    const store = new ReminderStore(storage)
    store.update({ time: '10:30' })
    storage.setItem(REMINDER_KEY, 'broken')
    expect(store.update({ push: true })).toBe(false)
    expect(store.getSnapshot().preferences.time).toBe('10:30')
    expect(store.rawData()).toBe('broken')
  })
  it('validates changed calendar dates before writing', () => {
    const storage = memory()
    const store = new ReminderStore(storage)
    expect(store.update({ dismissedDate: '2026-02-30' })).toBe(false)
    expect(storage.getItem(REMINDER_KEY)).toBeNull()
  })
})
