import { zonedMoment } from '../src/lib/reminders.ts'
import { formatDate } from '../src/lib/date.ts'
import type { SubscriptionData } from './push-protocol.ts'
import type {
  ReminderRepository,
  SavedSubscription,
} from './push-repository.ts'

export type PushSender = (
  subscription: SubscriptionData,
  payload: { title: string; body: string; tag: string },
) => Promise<void>
export class ReminderWorker {
  private repository: ReminderRepository
  private send: PushSender
  private running = false
  private cached: SavedSubscription[] | null = null
  private checked = new Map<string, string>()
  private revision = 0
  constructor(repository: ReminderRepository, send: PushSender) {
    this.repository = repository
    this.send = send
  }
  invalidate(subscriptionsChanged = false): void {
    this.revision++
    if (subscriptionsChanged) this.cached = null
    this.checked.clear()
  }
  async tick(now = new Date()): Promise<void> {
    if (this.running) return
    this.running = true
    const revision = this.revision
    try {
      if (this.cached === null) {
        const loaded = await this.repository.subscriptions()
        if (revision !== this.revision) return
        this.cached = loaded
      }
      const subscriptions = this.cached.filter((preferences) => {
        const moment = zonedMoment(now, preferences.timezone)
        return (
          moment.time >= preferences.time &&
          this.checked.get(preferences.id) !== moment.date
        )
      })
      if (subscriptions.length === 0) return
      const tasks = await this.repository.tasks()
      if (revision !== this.revision) return
      for (const preferences of subscriptions) {
        const moment = zonedMoment(now, preferences.timezone)
        let failed = false
        for (const task of tasks) {
          if (revision !== this.revision) break
          if (task.completed || task.deleted || task.deadline !== moment.date)
            continue
          const reservation = await this.repository.reserve(
            preferences.id,
            task,
          )
          if (reservation === 'waiting') {
            failed = true
            continue
          }
          if (reservation === 'settled') continue
          try {
            await this.send(preferences.subscription, {
              title: 'swask · Нагадування',
              body: `${task.title}\nДедлайн: ${formatDate(task.deadline!, { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
              tag: `swask-${task.id}-${task.deadline}`,
            })
            await this.repository.delivered(preferences.id, task)
          } catch (error) {
            if (
              typeof error === 'object' &&
              error !== null &&
              'statusCode' in error &&
              [404, 410].includes(Number(error.statusCode))
            ) {
              await this.repository.remove(preferences.id)
              this.cached =
                this.cached?.filter((value) => value.id !== preferences.id) ??
                null
              break
            }
            await this.repository.retry(preferences.id, task)
            failed = true
          }
        }
        if (!failed && revision === this.revision)
          this.checked.set(preferences.id, moment.date)
      }
    } finally {
      this.running = false
    }
  }
}
