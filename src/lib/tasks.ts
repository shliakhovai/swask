import { isDate, today } from './date.ts'

export interface TaskDraft {
  title: string
  description: string
  deadline: string | null
  link: string
}
export interface Task extends TaskDraft {
  id: string
  completed: boolean
  completedAt?: string | null
  deleted: boolean
  createdAt: string
  updatedAt: string
}
export type TaskPatch = Partial<TaskDraft & { completed: boolean }>
interface OperationBase {
  id: string
  taskId: string
  at: string
}
export type TaskOperation = OperationBase &
  (
    | { kind: 'create'; task: Task }
    | { kind: 'update'; changes: TaskPatch }
    | { kind: 'delete' }
  )
export interface TaskDocument {
  version: 1
  tasks: Task[]
  pending: TaskOperation[]
  scope: string | null
}

export const EMPTY_DOCUMENT: TaskDocument = {
  version: 1,
  tasks: [],
  pending: [],
  scope: null,
}
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
export const isId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
const isInstant = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value))

export function isTaskLink(value: unknown): value is string {
  if (value === '') return true
  if (typeof value !== 'string' || value.length > 2000) return false
  try {
    const url = new URL(value)
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    )
  } catch {
    return false
  }
}
const validators: Record<string, (value: unknown) => boolean> = {
  title: (value) =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= 160,
  description: (value) => typeof value === 'string' && value.length <= 4000,
  deadline: (value) => value === null || isDate(value),
  link: isTaskLink,
  completed: (value) => typeof value === 'boolean',
}
export function isTaskPatch(value: unknown): value is TaskPatch {
  return (
    isRecord(value) &&
    Object.keys(value).length > 0 &&
    Object.entries(value).every(
      ([key, field]) => validators[key]?.(field) === true,
    )
  )
}
export function isTask(value: unknown): value is Task {
  return (
    isRecord(value) &&
    isId(value.id) &&
    isInstant(value.createdAt) &&
    isInstant(value.updatedAt) &&
    (value.completedAt === undefined ||
      value.completedAt === null ||
      isInstant(value.completedAt)) &&
    typeof value.deleted === 'boolean' &&
    Object.keys(validators).every((key) => validators[key]!(value[key]))
  )
}
export function isOperation(value: unknown): value is TaskOperation {
  if (
    !isRecord(value) ||
    !isId(value.id) ||
    !isId(value.taskId) ||
    !isInstant(value.at)
  )
    return false
  if (value.kind === 'create')
    return (
      isTask(value.task) &&
      value.task.id === value.taskId &&
      !value.task.deleted
    )
  if (value.kind === 'update') return isTaskPatch(value.changes)
  return value.kind === 'delete'
}
export function parseDocument(value: unknown): TaskDocument {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.tasks) ||
    !value.tasks.every(isTask) ||
    !Array.isArray(value.pending) ||
    !value.pending.every(isOperation)
  )
    throw new Error('Некоректний формат збережених задач.')
  const tasks = (value.tasks as Task[]).map((task) => ({
    ...task,
    completedAt: completionTime(task),
  }))
  const pending = value.pending as TaskOperation[]
  if (
    new Set(tasks.map((task) => task.id)).size !== tasks.length ||
    new Set(pending.map((op) => op.id)).size !== pending.length
  )
    throw new Error('Збережені дані містять дублікати.')
  if (
    value.scope !== undefined &&
    value.scope !== null &&
    typeof value.scope !== 'string'
  )
    throw new Error('Некоректний простір синхронізації.')
  return {
    version: 1,
    tasks,
    pending,
    scope: typeof value.scope === 'string' ? value.scope : null,
  }
}
export function applyOperation(
  tasks: Task[],
  operation: TaskOperation,
): Task[] {
  if (operation.kind === 'create')
    return tasks.some((task) => task.id === operation.taskId)
      ? tasks
      : [
          ...tasks,
          { ...operation.task, completedAt: completionTime(operation.task) },
        ]
  return tasks.map((task) => {
    if (task.id !== operation.taskId || task.deleted) return task
    if (operation.kind === 'delete')
      return { ...task, deleted: true, updatedAt: operation.at }
    const completedAt =
      operation.changes.completed === false
        ? null
        : operation.changes.completed === true && !task.completed
          ? operation.at
          : completionTime(task)
    return {
      ...task,
      ...operation.changes,
      completedAt,
      updatedAt: operation.at,
    }
  })
}
export function completionTime(task: Task): string | null {
  return task.completed ? (task.completedAt ?? task.updatedAt) : null
}
export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      (a.deadline ?? '9999-99-99').localeCompare(b.deadline ?? '9999-99-99') ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  )
}
export function groupTasks(
  tasks: Task[],
  current = today(),
): { key: string; tasks: Task[] }[] {
  const groups = new Map<string, Task[]>([
    ['overdue', []],
    [current, []],
  ])
  for (const task of sortTasks(tasks)) {
    const key =
      task.deadline === null
        ? 'undated'
        : task.deadline < current
          ? 'overdue'
          : task.deadline
    groups.set(key, [...(groups.get(key) ?? []), task])
  }
  return [...groups]
    .filter(([key, values]) => key === current || values.length > 0)
    .map(([key, values]) => ({ key, tasks: values }))
}
