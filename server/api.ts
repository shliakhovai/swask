import { createHash, timingSafeEqual } from 'node:crypto'
import { parseOperations, type PublicConfig } from '../src/lib/sync-protocol.ts'
import { type Task, type TaskOperation } from '../src/lib/tasks.ts'

export const MAX_BODY_BYTES = 1_048_576
export interface ApiDependencies {
  config: PublicConfig
  syncKey: string
  sync(operations: TaskOperation[]): Promise<Task[]>
}
export function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}
export function authorized(request: Request, key: string): boolean {
  const provided =
    request.headers.get('authorization')?.replace(/^Bearer /, '') ?? ''
  return (
    key.length >= 16 &&
    timingSafeEqual(
      createHash('sha256').update(provided).digest(),
      createHash('sha256').update(key).digest(),
    )
  )
}
export async function handleApi(
  request: Request,
  dependencies: ApiDependencies,
): Promise<Response> {
  const path = new URL(request.url).pathname
  if (path === '/api/config' && request.method === 'GET')
    return jsonResponse(dependencies.config)
  if (path === '/api/health' && request.method === 'GET')
    return jsonResponse({ ok: true })
  if (path !== '/api/sync') return jsonResponse({ error: 'Не знайдено.' }, 404)
  if (request.method !== 'POST')
    return jsonResponse({ error: 'Потрібен POST-запит.' }, 405)
  if (!dependencies.config.syncEnabled)
    return jsonResponse(
      { error: 'Синхронізацію ще не ввімкнено для цього простору.' },
      503,
    )
  if (!authorized(request, dependencies.syncKey))
    return jsonResponse({ error: 'Перевір ключ твого простору.' }, 401)
  const raw = await request.text()
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES)
    return jsonResponse({ error: 'Завеликий запит.' }, 413)
  let operations: TaskOperation[]
  try {
    operations = parseOperations(JSON.parse(raw))
  } catch {
    return jsonResponse({ error: 'Некоректні дані синхронізації.' }, 400)
  }
  try {
    const tasks = await dependencies.sync(operations)
    return jsonResponse({
      tasks,
      acknowledged: operations.map((operation) => operation.id),
      spaceId: dependencies.config.spaceId,
    })
  } catch {
    return jsonResponse(
      {
        error:
          'Синхронізація тимчасово недоступна. Зміни збережено на пристрої.',
      },
      502,
    )
  }
}
