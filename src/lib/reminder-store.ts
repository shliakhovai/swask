import { isDate } from './date'
import { isReminderTime } from './reminders'
import { isRecord } from './tasks'
import type { TaskStorage } from './task-store'

export const REMINDER_KEY = 'swask.reminders.v1'
export interface ReminderPreferences {
  version: 1
  inApp: boolean
  push: boolean
  time: string
  dismissedDate: string | null
}
const defaults: ReminderPreferences = {
  version: 1,
  inApp: true,
  push: false,
  time: '09:00',
  dismissedDate: null,
}
interface ReminderState {
  preferences: ReminderPreferences
  error: string | null
}
export class ReminderStore {
  private storage: TaskStorage
  private listeners = new Set<() => void>()
  private state: ReminderState
  constructor(storage: TaskStorage) {
    this.storage = storage
    this.state = this.read()
  }
  private read(): ReminderState {
    try {
      const raw = this.storage.getItem(REMINDER_KEY)
      if (raw === null) return { preferences: defaults, error: null }
      const value: unknown = JSON.parse(raw)
      if (
        !isRecord(value) ||
        value.version !== 1 ||
        typeof value.inApp !== 'boolean' ||
        typeof value.push !== 'boolean' ||
        !isReminderTime(value.time) ||
        !(value.dismissedDate === null || isDate(value.dismissedDate))
      )
        throw new Error('Invalid preferences')
      return {
        preferences: {
          version: 1,
          inApp: value.inApp,
          push: value.push,
          time: value.time,
          dismissedDate: value.dismissedDate,
        },
        error: null,
      }
    } catch {
      return {
        preferences: defaults,
        error: 'Не вдалося прочитати налаштування нагадувань.',
      }
    }
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  refresh = () => {
    this.state = this.read()
    for (const listener of this.listeners) listener()
  }
  update(changes: Partial<Omit<ReminderPreferences, 'version'>>): boolean {
    const next = { ...this.state.preferences, ...changes }
    if (!isReminderTime(next.time)) return false
    try {
      this.storage.setItem(REMINDER_KEY, JSON.stringify(next))
      this.state = { preferences: next, error: null }
      for (const listener of this.listeners) listener()
      return true
    } catch {
      this.state = {
        ...this.state,
        error: 'Не вдалося зберегти налаштування нагадувань.',
      }
      for (const listener of this.listeners) listener()
      return false
    }
  }
}
