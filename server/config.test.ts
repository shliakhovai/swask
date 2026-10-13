import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readConfig } from './config'

describe('private configuration', () => {
  it('supports local mode and never puts database or private keys in public config', () => {
    expect(readConfig({}).publicConfig.syncEnabled).toBe(false)
    const config = readConfig({
      DATABASE_URL: 'postgresql://user:private-password@host.neon.tech/neondb',
      SWASK_SYNC_KEY: 'personal-workspace-key',
      VAPID_PUBLIC_KEY: 'public',
      VAPID_PRIVATE_KEY: 'private',
    })
    expect(JSON.stringify(config.publicConfig)).not.toContain('private')
    expect(() =>
      readConfig({
        DATABASE_URL: 'invalid-private-password',
        SWASK_SYNC_KEY: 'personal-workspace-key',
      }),
    ).toThrow('DATABASE_URL is not a valid')
  })
  it('fills missing .env keys while keeping existing credentials and generated keys stable', () => {
    const directory = mkdtempSync(resolve(tmpdir(), 'swask-config-'))
    try {
      writeFileSync(
        resolve(directory, '.env'),
        'DATABASE_URL=postgresql://user:keep-this@host.neon.tech/db\nSWASK_SYNC_KEY=existing-personal-workspace-key\n',
      )
      const script = resolve('scripts/setup-env.mjs')
      const output = execFileSync(process.execPath, [script], {
        cwd: directory,
        encoding: 'utf8',
      })
      const first = readFileSync(resolve(directory, '.env'), 'utf8')
      expect(first).toContain(
        'DATABASE_URL=postgresql://user:keep-this@host.neon.tech/db',
      )
      expect(first).toContain('SWASK_SYNC_KEY=existing-personal-workspace-key')
      expect(first).toMatch(/VAPID_PRIVATE_KEY=[A-Za-z0-9_-]+/)
      expect(output).not.toContain('keep-this')
      execFileSync(process.execPath, [script], { cwd: directory })
      expect(readFileSync(resolve(directory, '.env'), 'utf8')).toBe(first)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })
})
