import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import webPush from 'web-push'

const existed = existsSync('.env')
let content = existed
  ? readFileSync('.env', 'utf8')
  : readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
const value = (key) =>
  (content.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1] ?? '')
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
function setMissing(key, next) {
  if (value(key)) return
  const pattern = new RegExp(`^${key}=.*$`, 'm')
  content = pattern.test(content)
    ? content.replace(pattern, `${key}=${next}`)
    : `${content.trimEnd()}\n${key}=${next}\n`
}
if (Boolean(value('VAPID_PUBLIC_KEY')) !== Boolean(value('VAPID_PRIVATE_KEY')))
  throw new Error(
    'VAPID keys are incomplete. Supply both, or clear both and rerun setup.',
  )
setMissing('SWASK_SYNC_KEY', randomBytes(24).toString('base64url'))
if (!value('VAPID_PUBLIC_KEY')) {
  const keys = webPush.generateVAPIDKeys()
  setMissing('VAPID_PUBLIC_KEY', keys.publicKey)
  setMissing('VAPID_PRIVATE_KEY', keys.privateKey)
}
setMissing('VAPID_SUBJECT', 'https://github.com/shliakhovai/swask')
writeFileSync('.env', content, {
  mode: 0o600,
  ...(existed ? {} : { flag: 'wx' }),
})
chmodSync('.env', 0o600)
console.log(
  'Prepared .env with private access and push keys. Existing values were preserved. Add your Neon DATABASE_URL when ready.',
)
