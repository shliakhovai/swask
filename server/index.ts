import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { type ViteDevServer } from 'vite'
import { handleApi, jsonResponse, MAX_BODY_BYTES } from './api.ts'
import { readConfig } from './config.ts'
import { createNeonRepository } from './repository.ts'

const production = process.argv.includes('--production')
const portArgument = process.argv.indexOf('--port')
const port = Number(
  portArgument >= 0
    ? process.argv[portArgument + 1]
    : process.env.PORT || (production ? 4173 : 5173),
)
const host = process.env.HOST || (production ? '0.0.0.0' : '127.0.0.1')
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be a number between 1 and 65535.')
const config = readConfig()
const neon = config.databaseUrl
  ? createNeonRepository(config.databaseUrl)
  : null
const root = resolve('dist')
let vite: ViteDevServer | null = null
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
}

async function body(request: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    let failed = false
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        failed = true
        chunks.length = 0
        reject(new Error('BODY_TOO_LARGE'))
        return
      }
      if (!failed) chunks.push(chunk)
    })
    request.on('end', () => {
      if (!failed) resolveBody(Buffer.concat(chunks).toString('utf8'))
    })
    request.on('error', reject)
    request.on('aborted', () => reject(new Error('REQUEST_ABORTED')))
  })
}
async function send(response: ServerResponse, result: Response) {
  response.writeHead(
    result.status,
    Object.fromEntries(result.headers.entries()),
  )
  response.end(Buffer.from(await result.arrayBuffer()))
}
async function staticFile(pathname: string, response: ServerResponse) {
  let filename = resolve(root, `.${decodeURIComponent(pathname)}`)
  if (filename !== root && !filename.startsWith(root + sep)) {
    response.writeHead(404)
    response.end()
    return
  }
  try {
    if (!(await stat(filename)).isFile()) filename = resolve(root, 'index.html')
  } catch {
    if (extname(pathname)) {
      response.writeHead(404)
      response.end()
      return
    }
    filename = resolve(root, 'index.html')
  }
  const content = await readFile(filename)
  response.writeHead(200, {
    'content-type': mime[extname(filename)] ?? 'application/octet-stream',
    'cache-control': filename.includes(`${sep}assets${sep}`)
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  })
  response.end(content)
}
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://localhost:${port}`)
    if (url.pathname.startsWith('/api/')) {
      const headers = new Headers()
      for (const [key, value] of Object.entries(request.headers))
        if (typeof value === 'string') headers.set(key, value)
      const method = request.method ?? 'GET'
      const raw = ['GET', 'HEAD'].includes(method) ? null : await body(request)
      const apiRequest = new Request(url, {
        method,
        headers,
        ...(raw !== null ? { body: raw } : {}),
      })
      await send(
        response,
        await handleApi(apiRequest, {
          config: config.publicConfig,
          syncKey: config.syncKey,
          sync: (operations) => {
            if (!neon) throw new Error('Synchronization is disabled')
            return neon.repository.sync(operations)
          },
        }),
      )
      return
    }
    if (vite) {
      vite.middlewares(request, response)
      return
    }
    await staticFile(url.pathname, response)
  } catch (error) {
    if (!response.headersSent)
      await send(
        response,
        jsonResponse(
          { error: 'Не вдалося обробити запит.' },
          error instanceof Error && error.message === 'BODY_TOO_LARGE'
            ? 413
            : 500,
        ),
      )
    else response.end()
  }
})
server.requestTimeout = 30_000
server.headersTimeout = 15_000
if (!production) {
  const { createServer: createVite } = await import('vite')
  vite = await createVite({
    server: { middlewareMode: true, hmr: { server } },
    appType: 'spa',
  })
}
server.listen(port, host, () => {
  console.log(
    `swask → http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`,
  )
  console.log(
    config.publicConfig.syncEnabled
      ? 'Neon synchronization enabled.'
      : 'Local mode. Neon is optional; configure .env when ready.',
  )
})
function stop() {
  void vite?.close()
  server.close(() => process.exit(0))
  server.closeAllConnections()
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
