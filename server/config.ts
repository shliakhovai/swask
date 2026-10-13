import { createHash } from 'node:crypto'
import { type PublicConfig } from '../src/lib/sync-protocol.ts'

export function readConfig(env = process.env) {
  const databaseUrl = env.DATABASE_URL?.trim() ?? ''
  const syncKey = env.SWASK_SYNC_KEY?.trim() ?? ''
  if (databaseUrl && syncKey.length < 16)
    throw new Error(
      'Set SWASK_SYNC_KEY to at least 16 characters, or run npm run setup.',
    )
  let database: URL | null
  try {
    database = databaseUrl ? new URL(databaseUrl) : null
  } catch {
    throw new Error('DATABASE_URL is not a valid PostgreSQL connection string.')
  }
  if (database && !['postgres:', 'postgresql:'].includes(database.protocol))
    throw new Error('DATABASE_URL must be a PostgreSQL connection string.')
  const publicKey = env.VAPID_PUBLIC_KEY?.trim() ?? ''
  const privateKey = env.VAPID_PRIVATE_KEY?.trim() ?? ''
  const subject = env.VAPID_SUBJECT || 'https://github.com/shliakhovai/swask'
  if (Boolean(publicKey) !== Boolean(privateKey))
    throw new Error('Set both VAPID keys, or run npm run setup.')
  const vapid =
    publicKey && privateKey ? { publicKey, privateKey, subject } : null
  const publicConfig: PublicConfig = {
    syncEnabled: Boolean(database),
    spaceId: database
      ? createHash('sha256')
          .update(database.hostname + database.pathname)
          .digest('hex')
          .slice(0, 24)
      : null,
    pushEnabled: Boolean(database && vapid),
    pushPublicKey: database && vapid ? publicKey : null,
  }
  return { databaseUrl, syncKey, vapid, publicConfig }
}
