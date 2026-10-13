import {
  applyOperation,
  EMPTY_DOCUMENT,
  parseDocument,
  type Task,
  type TaskDocument,
  type TaskDraft,
  type TaskOperation,
  type TaskPatch,
} from './tasks.ts'

export const STORAGE_KEY = 'swask.tasks.v1'
export interface TaskStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}
export interface StoreSnapshot {
  document: TaskDocument
  error: string | null
  blocked: boolean
}

export class TaskStore {
  private storage: TaskStorage
  private listeners = new Set<() => void>()
  private snapshot: StoreSnapshot
  constructor(storage: TaskStorage) {
    this.storage = storage
    this.snapshot = this.read()
  }
  private read(): StoreSnapshot {
    try {
      const raw = this.storage.getItem(STORAGE_KEY)
      return {
        document:
          raw === null ? EMPTY_DOCUMENT : parseDocument(JSON.parse(raw)),
        error: null,
        blocked: false,
      }
    } catch {
      return {
        document: this.snapshot?.document ?? EMPTY_DOCUMENT,
        error:
          'Не вдалося прочитати локальні задачі. Збережені дані залишилися недоторканими.',
        blocked: true,
      }
    }
  }
  getSnapshot = (): StoreSnapshot => this.snapshot
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  refresh = (): void => {
    this.snapshot = this.read()
    this.emit()
  }
  private emit(): void {
    for (const listener of this.listeners) listener()
  }
  private save(document: TaskDocument): boolean {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(document))
      this.snapshot = { document, error: null, blocked: false }
      this.emit()
      return true
    } catch {
      this.snapshot = {
        ...this.snapshot,
        error:
          'Не вдалося зберегти зміни. Перевір доступ до сховища або вільне місце.',
      }
      this.emit()
      return false
    }
  }
  private commit(operation: TaskOperation): boolean {
    this.snapshot = this.read()
    if (this.snapshot.blocked) {
      this.emit()
      return false
    }
    const current = this.snapshot.document
    return this.save({
      version: 1,
      tasks: applyOperation(current.tasks, operation),
      pending: [...current.pending, operation],
    })
  }
  create(draft: TaskDraft): Task | null {
    const at = new Date().toISOString()
    const task: Task = {
      ...draft,
      id: crypto.randomUUID(),
      createdAt: at,
      updatedAt: at,
      completed: false,
      deleted: false,
    }
    return this.commit({
      id: crypto.randomUUID(),
      taskId: task.id,
      at,
      kind: 'create',
      task,
    })
      ? task
      : null
  }
  update(taskId: string, changes: TaskPatch): boolean {
    if (Object.keys(changes).length === 0) return true
    return this.commit({
      id: crypto.randomUUID(),
      taskId,
      at: new Date().toISOString(),
      kind: 'update',
      changes,
    })
  }
  delete(taskId: string): boolean {
    return this.commit({
      id: crypto.randomUUID(),
      taskId,
      at: new Date().toISOString(),
      kind: 'delete',
    })
  }
  reset(): boolean {
    return this.save(EMPTY_DOCUMENT)
  }
  rawData(): string | null {
    try {
      return this.storage.getItem(STORAGE_KEY)
    } catch {
      return null
    }
  }
}
