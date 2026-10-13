import { useEffect, useState } from 'react'
import { syncClient, useSync } from '../hooks/use-sync'
import { reminderStore, useReminders } from '../hooks/use-reminders'
import { usePwa } from '../hooks/use-pwa'
import { isReminderTime } from '../lib/reminders'
import { Icon } from './Icon'

function applicationKey(value: string): Uint8Array<ArrayBuffer> {
  const decoded = atob(value.replaceAll('-', '+').replaceAll('_', '/'))
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index++)
    bytes[index] = decoded.charCodeAt(index)
  return bytes
}
function subscriptionPreferences(subscription: PushSubscription, time: string) {
  return {
    subscription: subscription.toJSON(),
    time,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}
export function ReminderSettings() {
  const { preferences, error: storageError } = useReminders()
  const { config, connected } = useSync()
  const { offlineReady } = usePwa()
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const supported =
    window.isSecureContext &&
    'Notification' in window &&
    'PushManager' in window &&
    'serviceWorker' in navigator &&
    offlineReady
  const enabled =
    preferences.push &&
    subscription !== null &&
    'Notification' in window &&
    Notification.permission === 'granted'
  useEffect(() => {
    let active = true
    async function restore() {
      if (!supported || !connected || !config?.pushEnabled || !navigator.onLine)
        return
      const registration = await navigator.serviceWorker.getRegistration()
      const existing =
        (await registration?.pushManager.getSubscription()) ?? null
      if (!active) return
      setSubscription(existing)
      if (existing && preferences.push) {
        await syncClient.pushSubscription(
          'POST',
          subscriptionPreferences(existing, preferences.time),
        )
        if (active) setError('')
      }
    }
    const retry = () => {
      void restore().catch(() => {
        if (active)
          setError(
            'Час нагадувань оновиться після відновлення зв’язку із сервером.',
          )
      })
    }
    retry()
    window.addEventListener('online', retry)
    return () => {
      active = false
      window.removeEventListener('online', retry)
    }
  }, [
    supported,
    connected,
    config?.pushEnabled,
    preferences.push,
    preferences.time,
  ])
  async function enablePush() {
    if (!config?.pushPublicKey) return
    setBusy(true)
    setError('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted')
        throw new Error(
          'Дозволь сповіщення в налаштуваннях браузера, щоб отримувати нагадування.',
        )
      const registration = await navigator.serviceWorker.getRegistration()
      if (!registration?.active)
        throw new Error(
          'Спочатку відкрий установлений swask із доступною мережею.',
        )
      const existing = await registration.pushManager.getSubscription()
      const next =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationKey(config.pushPublicKey),
        }))
      try {
        await syncClient.pushSubscription(
          'POST',
          subscriptionPreferences(next, preferences.time),
        )
        if (!reminderStore.update({ push: true }))
          throw new Error('Не вдалося зберегти налаштування на пристрої.')
      } catch (error) {
        if (!existing) await next.unsubscribe()
        throw error
      }
      setSubscription(next)
    } catch (error) {
      setError(
        error instanceof DOMException
          ? 'Не вдалося ввімкнути сповіщення. Перевір дозвіл браузера та зв’язок із мережею.'
          : error instanceof Error
            ? error.message
            : 'Не вдалося ввімкнути сповіщення.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function disablePush() {
    if (!subscription) return
    setBusy(true)
    setError('')
    try {
      await syncClient.pushSubscription('DELETE', {
        endpoint: subscription.endpoint,
      })
      await subscription.unsubscribe()
      reminderStore.update({ push: false })
      setSubscription(null)
    } catch {
      setError(
        'Не вдалося вимкнути фонові нагадування. Перевір зв’язок і спробуй ще раз.',
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="setting-section">
      <h3>
        <Icon name="bell" size={16} />
        Нагадування
      </h3>
      <label className="setting-toggle">
        <input
          type="checkbox"
          checked={preferences.inApp}
          onChange={(event) =>
            reminderStore.update({ inApp: event.target.checked })
          }
        />
        Показувати нагадування в застосунку
      </label>
      <label className="reminder-time-label">
        Час нагадування
        <input
          type="time"
          value={preferences.time}
          onChange={(event) => {
            if (isReminderTime(event.target.value))
              reminderStore.update({ time: event.target.value })
          }}
        />
      </label>
      <p className="field-hint">
        У твоєму часовому поясі ·{' '}
        {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </p>
      {!config?.pushEnabled ? (
        <p>Фонові нагадування ще не ввімкнено для цього простору.</p>
      ) : !connected ? (
        <p>Під’єднай цей пристрій, щоб отримувати фонові нагадування.</p>
      ) : !supported ? (
        <p>
          Для push-нагадувань відкрий установлену версію swask у браузері з
          підтримкою сповіщень. На iPhone додай застосунок на початковий екран.
        </p>
      ) : (
        <>
          <p>
            {enabled
              ? 'Нагадування приходитимуть навіть із закритим swask.'
              : 'Дозволь сповіщення, щоб отримувати нагадування із закритим swask.'}
          </p>
          <button
            className="button secondary"
            disabled={busy || !navigator.onLine}
            onClick={() => void (enabled ? disablePush() : enablePush())}
          >
            {busy
              ? 'Зберігаємо…'
              : enabled
                ? 'Вимкнути push-нагадування'
                : 'Увімкнути push-нагадування'}
          </button>
        </>
      )}
      {(error || storageError) && (
        <p className="form-error" role="alert">
          {error || storageError}
        </p>
      )}
    </section>
  )
}
