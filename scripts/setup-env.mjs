import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

if (existsSync('.env')) {
  console.log('.env already exists; left unchanged.')
} else {
  const template = readFileSync('.env.example', 'utf8')
  writeFileSync(
    '.env',
    template.replace(
      'SWASK_SYNC_KEY=',
      `SWASK_SYNC_KEY=${randomBytes(24).toString('base64url')}`,
    ),
    { mode: 0o600, flag: 'wx' },
  )
  console.log(
    'Created .env with a private sync key. Add your Neon DATABASE_URL to enable synchronization.',
  )
}
