import { neon } from '@neondatabase/serverless'
import { isTask, type Task, type TaskOperation } from '../src/lib/tasks.ts'
import { TASK_MIGRATION } from './migrations.ts'
import { PUSH_MIGRATION } from './push-migrations.ts'

export interface SqlDatabase {
  query(
    text: string,
    parameters?: unknown[],
  ): Promise<Record<string, unknown>[]>
}
export class TaskRepository {
  private database: SqlDatabase
  constructor(database: SqlDatabase) {
    this.database = database
  }
  async sync(operations: TaskOperation[]): Promise<Task[]> {
    const rows = await this.database.query(
      'SELECT swask_apply_operations($1::jsonb) AS tasks',
      [JSON.stringify(operations)],
    )
    const tasks = rows[0]?.tasks
    if (!Array.isArray(tasks) || !tasks.every(isTask))
      throw new Error('Database returned an invalid task snapshot')
    return tasks
  }
}
export function createNeonRepository(url: string) {
  const sql = neon(url)
  let migration: Promise<unknown> | null = null
  async function initialize() {
    migration ??= sql.transaction(
      [...TASK_MIGRATION, ...PUSH_MIGRATION].map((statement) =>
        sql.query(statement),
      ),
    )
    try {
      await migration
    } catch (error) {
      migration = null
      throw error
    }
  }
  const database: SqlDatabase = {
    query: async (text, parameters) => {
      await initialize()
      return await sql.query(text, parameters ?? [])
    },
  }
  return { repository: new TaskRepository(database), initialize, database }
}
