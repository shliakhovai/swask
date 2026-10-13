import { useEffect, useState } from 'react'
import { syncClient, useSync } from '../hooks/use-sync'
import { reminderStore, useReminders } from '../hooks/use-reminders'
import { usePwa } from '../hooks/use-pwa'
import { isReminderTime } from '../lib/reminders'
import { PushSetupError, savePushOptIn } from '../lib/push-setup'
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
  const { preferences, blocked, error: storageError } = useReminders()
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
  const optedIn = preferences.push || subscription !== null
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
      if (
        existing &&
        preferences.push &&
        !blocked &&
        Notification.permission === 'granted'
      ) {
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
    blocked,
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
        await savePushOptIn(next, Boolean(existing), {
          save: () =>
            syncClient.pushSubscription(
              'POST',
              subscriptionPreferences(next, preferences.time),
            ),
          remove: () =>
            syncClient.pushSubscription('DELETE', { endpoint: next.endpoint }),
          persist: () => reminderStore.update({ push: true }),
        })
      } catch (error) {
        setSubscription(
          error instanceof PushSetupError && error.keepSubscription
            ? next
            : null,
        )
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
    setBusy(true)
    setError('')
    try {
      let existing = subscription
      if (!existing) {
        const registration = await navigator.serviceWorker.getRegistration()
        existing = (await registration?.pushManager.getSubscription()) ?? null
      }
      if (existing) {
        await syncClient.pushSubscription('DELETE', {
          endpoint: existing.endpoint,
        })
        await existing.unsubscribe()
      }
      setSubscription(null)
      if (!reminderStore.update({ push: false }))
        throw new Error(
          reminderStore.getSnapshot().error ??
            'Не вдалося зберегти налаштування.',
        )
    } catch (error) {
      setError(
        error instanceof Error &&
          !(error instanceof TypeError) &&
          !(error instanceof DOMException)
          ? error.message
          : 'Не вдалося вимкнути фонові нагадування. Перевір зв’язок і спробуй ще раз.',
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
          disabled={blocked || busy}
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
          disabled={blocked || busy}
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
              : optedIn
                ? 'Можеш вимкнути цю підписку або перевірити дозвіл сповіщень у браузері.'
                : 'Дозволь сповіщення, щоб отримувати нагадування із закритим swask.'}
          </p>
          <button
            className="button secondary"
            disabled={busy || !navigator.onLine || (blocked && !optedIn)}
            onClick={() => void (optedIn ? disablePush() : enablePush())}
          >
            {busy
              ? 'Зберігаємо…'
              : optedIn
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
      {blocked && (
        <div className="reminder-recovery">
          <p>Завантаж копію пошкоджених налаштувань перед скиданням.</p>
          <button
            className="button secondary"
            onClick={() => {
              const raw = reminderStore.rawData()
              if (raw === null) {
                setError('Не вдалося прочитати дані для завантаження.')
                return
              }
              const url = URL.createObjectURL(
                new Blob([raw], { type: 'application/json' }),
              )
              const link = document.createElement('a')
              link.href = url
              link.download = 'swask-reminders-recovery.json'
              link.click()
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            }}
          >
            Завантажити налаштування нагадувань
          </button>
          <button
            className="button danger"
            onClick={() => {
              if (
                confirm(
                  'Скинути пошкоджені налаштування нагадувань? Твої задачі залишаться збереженими.',
                ) &&
                reminderStore.reset()
              )
                setError('')
            }}
          >
            Скинути налаштування нагадувань
          </button>
        </div>
      )}
    </section>
  )
}
