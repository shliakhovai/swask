import {
  isPublicConfig,
  isSyncResponse,
  type PublicConfig,
} from './sync-protocol.ts'
import { type TaskStore, type TaskStorage } from './task-store.ts'

export const CREDENTIAL_KEY = 'swask.sync.key.v1'
export type SyncStatus =
  'local' | 'disconnected' | 'syncing' | 'synced' | 'offline' | 'error'
interface SyncState {
  config: PublicConfig | null
  status: SyncStatus
  error: string | null
  lastSyncedAt: string | null
  connected: boolean
}

export class SyncClient {
  private tasks: TaskStore
  private storage: TaskStorage
  private fetcher: typeof fetch
  private key = ''
  private generation = 0
  private inFlight: Promise<boolean> | null = null
  private initializing: Promise<void> | null = null
  private listeners = new Set<() => void>()
  private state: SyncState = {
    config: null,
    status: 'local',
    error: null,
    lastSyncedAt: null,
    connected: false,
  }
  constructor(tasks: TaskStore, storage: TaskStorage, fetcher = fetch) {
    this.tasks = tasks
    this.storage = storage
    this.fetcher = fetcher
    try {
      this.key = storage.getItem(CREDENTIAL_KEY) ?? ''
    } catch {
      /* Local task storage reports storage errors separately. */
    }
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  refreshCredentials(): boolean {
    try {
      const key = this.storage.getItem(CREDENTIAL_KEY) ?? ''
      if (key === this.key) return false
      this.generation++
      this.key = key
      this.update({
        connected: Boolean(key) && Boolean(this.state.config?.syncEnabled),
        status: key ? 'offline' : 'disconnected',
        lastSyncedAt: null,
        error: null,
      })
      return true
    } catch {
      this.generation++
      this.key = ''
      this.update({
        connected: false,
        status: 'error',
        error: 'Не вдалося прочитати ключ на пристрої.',
      })
      return false
    }
  }
  private update(changes: Partial<SyncState>) {
    this.state = { ...this.state, ...changes }
    for (const listener of this.listeners) listener()
  }
  private async request(
    path: string,
    options: RequestInit = {},
  ): Promise<unknown> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    try {
      const fetcher = this.fetcher
      const response = await fetcher(path, {
        ...options,
        signal: controller.signal,
        cache: 'no-store',
      })
      const result: unknown = await response.json()
      if (!response.ok) {
        const message =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'Синхронізація тимчасово недоступна.'
        throw new Error(message)
      }
      return result
    } finally {
      clearTimeout(timeout)
    }
  }
  initialize(): Promise<void> {
    if (this.initializing) return this.initializing
    this.initializing = (async () => {
      try {
        const config = await this.request('/api/config')
        if (!isPublicConfig(config))
          throw new Error('Некоректна відповідь сервера.')
        this.update({
          config,
          status: config.syncEnabled
            ? this.key
              ? 'offline'
              : 'disconnected'
            : 'local',
          connected: config.syncEnabled && Boolean(this.key),
          error: null,
        })
      } catch {
        this.update({
          error: 'Сервер недоступний. Локальні задачі залишаються доступними.',
        })
      }
    })().finally(() => {
      this.initializing = null
    })
    return this.initializing
  }
  async connect(key: string): Promise<boolean> {
    if (this.inFlight) await this.inFlight
    if (!this.state.config) await this.initialize()
    const previous = this.key
    this.key = key.trim()
    this.generation++
    const generation = this.generation
    if (this.key.length < 16) {
      this.key = previous
      this.update({ error: 'Ключ має містити щонайменше 16 символів.' })
      return false
    }
    const success = await this.sync()
    if (generation !== this.generation) return false
    if (!success) {
      this.key = previous
      return false
    }
    try {
      this.storage.setItem(CREDENTIAL_KEY, this.key)
      this.update({ connected: true })
      return true
    } catch {
      this.key = previous
      this.update({
        status: 'error',
        connected: Boolean(previous),
        error: 'Не вдалося зберегти ключ на пристрої.',
      })
      return false
    }
  }
  disconnect(): boolean {
    try {
      this.storage.setItem(CREDENTIAL_KEY, '')
    } catch {
      this.update({
        error: 'Не вдалося від’єднати пристрій: сховище недоступне.',
      })
      return false
    }
    this.generation++
    this.key = ''
    this.update({ connected: false, status: 'disconnected', error: null })
    return true
  }
  offline() {
    if (this.key) this.update({ status: 'offline' })
  }
  sync(): Promise<boolean> {
    if (this.inFlight) return this.inFlight
    this.inFlight = this.runSync().finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }
  private async runSync(): Promise<boolean> {
    const config = this.state.config
    if (!config?.syncEnabled || !config.spaceId || !this.key) return false
    const generation = this.generation
    const local = this.tasks.getSnapshot()
    if (local.blocked) return false
    if (local.document.scope && local.document.scope !== config.spaceId) {
      this.update({
        status: 'error',
        error:
          'Цей пристрій прив’язаний до іншого простору. Збережи копію задач перед зміною сервера.',
      })
      return false
    }
    this.update({ status: 'syncing', error: null })
    try {
      do {
        const operations = this.tasks
          .getSnapshot()
          .document.pending.slice(0, 100)
        const response = await this.request('/api/sync', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${this.key}`,
          },
          body: JSON.stringify({ spaceId: config.spaceId, operations }),
        })
        if (generation !== this.generation) return false
        const ids = new Set(operations.map((operation) => operation.id))
        if (
          !isSyncResponse(response) ||
          response.spaceId !== config.spaceId ||
          new Set(response.acknowledged).size !== ids.size ||
          !response.acknowledged.every((id) => ids.has(id))
        )
          throw new Error('Сервер повернув некоректне підтвердження змін.')
        if (
          !this.tasks.acceptRemote(
            response.tasks,
            response.acknowledged,
            config.spaceId,
          )
        )
          throw new Error(
            'Не вдалося зберегти результат синхронізації. Зміни залишилися в черзі.',
          )
      } while (this.tasks.getSnapshot().document.pending.length > 0)
      this.update({
        status: 'synced',
        lastSyncedAt: new Date().toISOString(),
        error: null,
        connected: true,
      })
      return true
    } catch (error) {
      if (generation !== this.generation) return false
      this.update({
        status: 'error',
        error:
          error instanceof Error &&
          error.name !== 'TypeError' &&
          error.name !== 'AbortError'
            ? error.message
            : 'Немає зв’язку із сервером. Зміни залишаються на пристрої.',
      })
      return false
    }
  }
}
