import { isRecord } from '../src/lib/tasks.ts'
import { isReminderTime } from '../src/lib/reminders.ts'

export interface SubscriptionData {
  endpoint: string
  keys: { auth: string; p256dh: string }
}
export interface PushPreferences {
  subscription: SubscriptionData
  time: string
  timezone: string
}
export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4000) return false
  try {
    const url = new URL(value)
    const host = url.hostname
    const known =
      [
        'fcm.googleapis.com',
        'android.googleapis.com',
        'updates.push.services.mozilla.com',
      ].includes(host) ||
      host.endsWith('.push.apple.com') ||
      host.endsWith('.notify.windows.com') ||
      host.endsWith('.wns.windows.com')
    return (
      url.protocol === 'https:' &&
      known &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443')
    )
  } catch {
    return false
  }
}
function isKey(value: unknown, bytes: number): value is string {
  return (
    typeof value === 'string' &&
    value.length < 100 &&
    /^[A-Za-z0-9_-]+={0,2}$/.test(value) &&
    Buffer.from(value, 'base64url').length === bytes
  )
}
export function parsePushPreferences(value: unknown): PushPreferences {
  if (
    !isRecord(value) ||
    !isRecord(value.subscription) ||
    !isPushEndpoint(value.subscription.endpoint) ||
    !isRecord(value.subscription.keys) ||
    !isKey(value.subscription.keys.auth, 16) ||
    !isKey(value.subscription.keys.p256dh, 65) ||
    !isReminderTime(value.time) ||
    typeof value.timezone !== 'string' ||
    value.timezone.length > 100
  )
    throw new Error('Invalid push subscription')
  try {
    new Intl.DateTimeFormat('en', { timeZone: value.timezone }).format()
  } catch {
    throw new Error('Invalid time zone')
  }
  return {
    subscription: {
      endpoint: value.subscription.endpoint,
      keys: {
        auth: value.subscription.keys.auth,
        p256dh: value.subscription.keys.p256dh,
      },
    },
    time: value.time,
    timezone: value.timezone,
  }
}
