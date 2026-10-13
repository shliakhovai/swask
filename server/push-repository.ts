import { createHash } from 'node:crypto'
import { isTask, type Task } from '../src/lib/tasks.ts'
import { type SqlDatabase } from './repository.ts'
import { parsePushPreferences, type PushPreferences } from './push-protocol.ts'

export interface SavedSubscription extends PushPreferences {
  id: string
}
export interface ReminderRepository {
  subscriptions(): Promise<SavedSubscription[]>
  tasks(): Promise<Task[]>
  reserve(
    subscription: string,
    task: Task,
  ): Promise<'claimed' | 'waiting' | 'settled'>
  delivered(subscription: string, task: Task): Promise<void>
  retry(subscription: string, task: Task): Promise<void>
  remove(id: string): Promise<void>
}
export const subscriptionId = (endpoint: string) =>
  createHash('sha256').update(endpoint).digest('hex')
export class PushRepository implements ReminderRepository {
  private database: SqlDatabase
  constructor(database: SqlDatabase) {
    this.database = database
  }
  async upsert(preferences: PushPreferences) {
    await this.database.query(
      'INSERT INTO swask_push_subscriptions(id, subscription, timezone, reminder_time) VALUES ($1, $2::jsonb, $3, $4) ON CONFLICT (id) DO UPDATE SET subscription = EXCLUDED.subscription, timezone = EXCLUDED.timezone, reminder_time = EXCLUDED.reminder_time, updated_at = now()',
      [
        subscriptionId(preferences.subscription.endpoint),
        JSON.stringify(preferences.subscription),
        preferences.timezone,
        preferences.time,
      ],
    )
  }
  async remove(id: string) {
    await this.database.query(
      'DELETE FROM swask_push_subscriptions WHERE id = $1',
      [id],
    )
  }
  async subscriptions(): Promise<SavedSubscription[]> {
    const rows = await this.database.query(
      'SELECT id, subscription, timezone, reminder_time AS time FROM swask_push_subscriptions',
    )
    return rows.map((row) => {
      if (typeof row.id !== 'string') throw new Error('Invalid subscription ID')
      return { id: row.id, ...parsePushPreferences(row) }
    })
  }
  async tasks(): Promise<Task[]> {
    const rows = await this.database.query(
      `SELECT data FROM swask_tasks WHERE (data->>'completed')::boolean = false AND (data->>'deleted')::boolean = false AND data->>'deadline' BETWEEN to_char((now() AT TIME ZONE 'UTC') - interval '1 day', 'YYYY-MM-DD') AND to_char((now() AT TIME ZONE 'UTC') + interval '1 day', 'YYYY-MM-DD')`,
    )
    return rows.map((row) => {
      if (!isTask(row.data)) throw new Error('Invalid task')
      return row.data
    })
  }
  async reserve(
    subscription: string,
    task: Task,
  ): Promise<'claimed' | 'waiting' | 'settled'> {
    const rows = await this.database.query(
      `INSERT INTO swask_push_deliveries(subscription_id, task_id, deadline, locked_until) SELECT $1, id, $3, now() + interval '5 minutes' FROM swask_tasks WHERE id = $2::uuid AND (data->>'completed')::boolean = false AND (data->>'deleted')::boolean = false AND data->>'deadline' = $3 ON CONFLICT (subscription_id, task_id, deadline) DO UPDATE SET locked_until = EXCLUDED.locked_until WHERE swask_push_deliveries.sent_at IS NULL AND swask_push_deliveries.locked_until < now() RETURNING task_id`,
      [subscription, task.id, task.deadline],
    )
    if (rows.length > 0) return 'claimed'
    const pending = await this.database.query(
      `SELECT 1 FROM swask_push_deliveries delivery JOIN swask_tasks task ON task.id = delivery.task_id WHERE delivery.subscription_id = $1 AND delivery.task_id = $2::uuid AND delivery.deadline = $3 AND delivery.sent_at IS NULL AND (task.data->>'completed')::boolean = false AND (task.data->>'deleted')::boolean = false AND task.data->>'deadline' = $3`,
      [subscription, task.id, task.deadline],
    )
    return pending.length ? 'waiting' : 'settled'
  }
  async delivered(subscription: string, task: Task) {
    await this.database.query(
      'UPDATE swask_push_deliveries SET sent_at = now() WHERE subscription_id = $1 AND task_id = $2::uuid AND deadline = $3',
      [subscription, task.id, task.deadline],
    )
  }
  async retry(subscription: string, task: Task) {
    await this.database.query(
      `UPDATE swask_push_deliveries SET locked_until = now() + interval '5 minutes' WHERE subscription_id = $1 AND task_id = $2::uuid AND deadline = $3 AND sent_at IS NULL`,
      [subscription, task.id, task.deadline],
    )
  }
}
