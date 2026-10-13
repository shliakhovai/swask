import { sortTasks, type Task } from './tasks.ts'

export const isReminderTime = (value: unknown): value is string =>
  typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)
export function zonedMoment(
  now: Date,
  timeZone: string,
): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}
export function dueReminders(
  tasks: Task[],
  date: string,
  time: string,
  reminderTime: string,
): Task[] {
  if (time < reminderTime) return []
  return sortTasks(
    tasks.filter(
      (task) =>
        !task.completed &&
        !task.deleted &&
        task.deadline !== null &&
        task.deadline <= date,
    ),
  )
}
