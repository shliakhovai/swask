import { createHash } from 'node:crypto'
import { type PublicConfig } from '../src/lib/sync-protocol.ts'

export function readConfig(env = process.env) {
  const databaseUrl = env.DATABASE_URL?.trim() ?? ''
  const syncKey = env.SWASK_SYNC_KEY?.trim() ?? ''
  if (databaseUrl && syncKey.length < 16)
    throw new Error(
      'Set SWASK_SYNC_KEY to at least 16 characters, or run npm run setup.',
    )
  const database = databaseUrl ? new URL(databaseUrl) : null
  if (database && !['postgres:', 'postgresql:'].includes(database.protocol))
    throw new Error('DATABASE_URL must be a PostgreSQL connection string.')
  const publicConfig: PublicConfig = {
    syncEnabled: Boolean(database),
    spaceId: database
      ? createHash('sha256')
          .update(database.hostname + database.pathname)
          .digest('hex')
          .slice(0, 24)
      : null,
    pushEnabled: false,
    pushPublicKey: null,
  }
  return { databaseUrl, syncKey, publicConfig }
}
