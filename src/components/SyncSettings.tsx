import { useState, type FormEvent } from 'react'
import { syncClient, useSync } from '../hooks/use-sync'
import { taskStore, useTasks } from '../hooks/use-tasks'
import { Icon } from './Icon'

export function SyncSettings() {
  const { config, connected, status, error, lastSyncedAt } = useSync()
  const { document: taskData } = useTasks()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  async function connect(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      if (await syncClient.connect(key)) setKey('')
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="setting-section">
      <h3>
        <Icon name="cloud" size={16} />
        Між твоїми пристроями
      </h3>
      {!config?.syncEnabled ? (
        <p>
          Синхронізацію ще не ввімкнено для цього простору. Усі задачі доступні
          на цьому пристрої.
        </p>
      ) : connected ? (
        <>
          <p>
            {status === 'synced'
              ? 'Усі зміни синхронізовано.'
              : status === 'syncing'
                ? 'Обмінюємося змінами…'
                : 'Зміни зберігаються на пристрої до повернення зв’язку.'}
          </p>
          <p className="field-hint">
            {taskData.pending.length > 0
              ? `${taskData.pending.length} змін у черзі`
              : lastSyncedAt
                ? `Останній обмін: ${new Date(lastSyncedAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`
                : 'Очікуємо на перший обмін'}
          </p>
          <div className="settings-buttons">
            <button
              className="button secondary"
              disabled={status === 'syncing'}
              onClick={() => void syncClient.sync()}
            >
              <Icon name="refresh" size={16} />
              Синхронізувати
            </button>
            <button
              className="text-button"
              onClick={() => syncClient.disconnect()}
            >
              Від’єднати пристрій
            </button>
          </div>
        </>
      ) : (
        <form className="sync-form" onSubmit={(event) => void connect(event)}>
          <p>
            Введи той самий ключ простору на своїх пристроях, щоб бачити спільні
            задачі.
          </p>
          <label>
            Ключ твого простору
            <input
              type="password"
              autoComplete="off"
              minLength={16}
              value={key}
              onChange={(event) => setKey(event.target.value)}
              required
            />
          </label>
          <button className="button secondary" disabled={busy} type="submit">
            {busy ? 'Під’єднуємо…' : 'Під’єднати пристрій'}
          </button>
        </form>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button
        className="text-button"
        onClick={() => {
          const raw = taskStore.rawData()
          if (!raw) return
          const url = URL.createObjectURL(
            new Blob([raw], { type: 'application/json' }),
          )
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.download = 'swask-tasks.json'
          anchor.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }}
      >
        <Icon name="download" size={14} />
        Завантажити копію задач
      </button>
    </section>
  )
}
