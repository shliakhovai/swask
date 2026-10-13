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
  blocked: boolean
}
function isPreferences(value: unknown): value is ReminderPreferences {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.inApp === 'boolean' &&
    typeof value.push === 'boolean' &&
    isReminderTime(value.time) &&
    (value.dismissedDate === null || isDate(value.dismissedDate))
  )
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
      if (raw === null)
        return { preferences: defaults, error: null, blocked: false }
      const value: unknown = JSON.parse(raw)
      if (!isPreferences(value)) throw new Error('Invalid preferences')
      return { preferences: value, error: null, blocked: false }
    } catch {
      return {
        preferences: this.state?.preferences ?? defaults,
        error:
          'Не вдалося прочитати налаштування нагадувань. Збережені дані залишилися недоторканими.',
        blocked: true,
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
  private emit() {
    for (const listener of this.listeners) listener()
  }
  refresh = () => {
    this.state = this.read()
    this.emit()
  }
  private save(preferences: ReminderPreferences): boolean {
    try {
      this.storage.setItem(REMINDER_KEY, JSON.stringify(preferences))
      this.state = { preferences, error: null, blocked: false }
      this.emit()
      return true
    } catch {
      this.state = {
        ...this.state,
        error: 'Не вдалося зберегти налаштування нагадувань.',
      }
      this.emit()
      return false
    }
  }
  update(changes: Partial<Omit<ReminderPreferences, 'version'>>): boolean {
    this.state = this.read()
    if (this.state.blocked) {
      this.emit()
      return false
    }
    const next = { ...this.state.preferences, ...changes }
    if (!isPreferences(next)) return false
    return this.save(next)
  }
  reset(): boolean {
    return this.save(defaults)
  }
  rawData(): string | null {
    try {
      return this.storage.getItem(REMINDER_KEY)
    } catch {
      return null
    }
  }
}
