import { describe, expect, it } from 'vitest'
import { sample } from '../../tests/fixtures/task'
import { dueReminders, isReminderTime, zonedMoment } from './reminders'
import { ReminderStore } from './reminder-store'
import { pushMessage } from './push-message'

describe('reminder time and preferences', () => {
  it('uses the device time zone across DST and midnight', () => {
    expect(
      zonedMoment(new Date('2026-10-13T06:00:00Z'), 'Europe/Kyiv'),
    ).toEqual({ date: '2026-10-13', time: '09:00' })
    expect(
      zonedMoment(new Date('2026-10-25T07:00:00Z'), 'Europe/Kyiv'),
    ).toEqual({ date: '2026-10-25', time: '09:00' })
    expect(
      zonedMoment(new Date('2026-10-13T22:30:00Z'), 'Europe/Kyiv').date,
    ).toBe('2026-10-14')
  })
  it('shows due and overdue tasks after the configured time only', () => {
    const task = { ...sample, deadline: '2026-10-13' }
    expect(dueReminders([task], '2026-10-13', '08:59', '09:00')).toHaveLength(0)
    expect(
      dueReminders(
        [
          task,
          { ...task, id: 'older', deadline: '2026-10-12' },
          { ...task, completed: true },
        ],
        '2026-10-13',
        '09:00',
        '09:00',
      ).map((task) => task.id),
    ).toEqual(['older', sample.id])
    expect(isReminderTime('24:00')).toBe(false)
  })
  it('persists preferences and does not report success after a failed write', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
    }
    const store = new ReminderStore(storage)
    store.update({ time: '10:30', inApp: false })
    expect(new ReminderStore(storage).getSnapshot().preferences).toMatchObject({
      time: '10:30',
      inApp: false,
    })
    const blocked = new ReminderStore({
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
    })
    expect(blocked.update({ time: '10:30' })).toBe(false)
    expect(blocked.getSnapshot().preferences.time).toBe('09:00')
  })
  it('bounds push display data and safely handles an invalid payload', () => {
    expect(
      pushMessage({
        title: 'a'.repeat(1000),
        body: 'b'.repeat(1000),
        tag: 'c'.repeat(1000),
      }).body,
    ).toHaveLength(500)
    expect(pushMessage(null).title).toBe('swask')
  })
})
