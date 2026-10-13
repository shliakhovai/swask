import { describe, expect, it } from 'vitest'
import { sample } from '../tests/fixtures/task'
import { handleApi, MAX_BODY_BYTES, type ApiDependencies } from './api'

const key = 'test-workspace-key-12345'
const dependencies: ApiDependencies = {
  config: {
    syncEnabled: true,
    spaceId: 'test-space',
    pushEnabled: false,
    pushPublicKey: null,
  },
  syncKey: key,
  sync: async () => [sample],
}
const request = (value: Record<string, unknown>, token = key) =>
  new Request('http://localhost/api/sync', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ spaceId: 'test-space', ...value }),
  })
describe('sync API', () => {
  it('rejects a stale or missing workspace binding before applying operations', async () => {
    let applied = false
    const guarded = {
      ...dependencies,
      sync: async () => {
        applied = true
        return []
      },
    }
    for (const spaceId of ['previous-database', undefined]) {
      const response = await handleApi(
        request({
          spaceId,
          operations: [
            {
              id: crypto.randomUUID(),
              taskId: sample.id,
              at: sample.updatedAt,
              kind: 'create',
              task: sample,
            },
          ],
        }),
        guarded,
      )
      expect(response.status).toBe(409)
      expect(applied).toBe(false)
    }
  })
  it('exposes only public configuration and rejects unauthenticated requests', async () => {
    const config = await handleApi(
      new Request('http://localhost/api/config'),
      dependencies,
    )
    expect(await config.text()).not.toContain(key)
    expect(
      (await handleApi(request({ operations: [] }, 'wrong'), dependencies))
        .status,
    ).toBe(401)
  })
  it('validates operations, deadlines and writable fields before the database', async () => {
    const op = {
      id: crypto.randomUUID(),
      taskId: sample.id,
      at: sample.updatedAt,
      kind: 'update',
    }
    for (const changes of [
      { deadline: '2026-02-30' },
      { deleted: false },
      { link: 'javascript:alert(1)' },
    ])
      expect(
        (
          await handleApi(
            request({ operations: [{ ...op, changes }] }),
            dependencies,
          )
        ).status,
      ).toBe(400)
    expect(
      (
        await handleApi(
          request({ operations: Array.from({ length: 101 }, () => op) }),
          dependencies,
        )
      ).status,
    ).toBe(400)
  })
  it('returns acknowledged operation IDs and a cloud snapshot', async () => {
    const op = {
      id: crypto.randomUUID(),
      taskId: sample.id,
      at: sample.updatedAt,
      kind: 'update',
      changes: { completed: true },
    }
    const response = await handleApi(
      request({ operations: [op] }),
      dependencies,
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      acknowledged: [op.id],
      spaceId: 'test-space',
      tasks: [sample],
    })
  })
  it('bounds request sizes and hides provider errors', async () => {
    expect(
      (
        await handleApi(
          new Request('http://localhost/api/sync', {
            method: 'POST',
            headers: { authorization: `Bearer ${key}` },
            body: 'a'.repeat(MAX_BODY_BYTES + 1),
          }),
          dependencies,
        )
      ).status,
    ).toBe(413)
    const response = await handleApi(request({ operations: [] }), {
      ...dependencies,
      sync: async () => {
        throw new Error('postgres://private:password@host')
      },
    })
    expect(response.status).toBe(502)
    expect(await response.text()).not.toContain('password')
  })
})
