import { createServer } from 'node:http'

// Proxy the production build on a separate origin for each update journey.
// Only a worker version probe is appended; its real lifecycle code is retained.
export async function pwaUpdateServer(
  upstream: string,
  api?: (request: Request) => Promise<Response>,
) {
  let version = 1
  const server = createServer((request, response) => {
    void (async () => {
      const currentVersion = version
      const url = new URL(request.url ?? '/', upstream)
      if (api && url.pathname.startsWith('/api/')) {
        const chunks: Buffer[] = []
        for await (const chunk of request)
          chunks.push(Buffer.from(chunk as Uint8Array))
        const headers = new Headers()
        for (const [key, value] of Object.entries(request.headers)) {
          if (typeof value === 'string') headers.set(key, value)
          else if (Array.isArray(value)) headers.set(key, value.join(', '))
        }
        const method = request.method ?? 'GET'
        const result = await api(
          new Request(url, {
            method,
            headers,
            ...(!['GET', 'HEAD'].includes(method)
              ? { body: Buffer.concat(chunks).toString() }
              : {}),
          }),
        )
        response.statusCode = result.status
        result.headers.forEach((value, key) => response.setHeader(key, value))
        response.end(Buffer.from(await result.arrayBuffer()))
        return
      }
      const result = await fetch(url)
      response.statusCode = result.status
      response.setHeader(
        'content-type',
        result.headers.get('content-type') ?? 'application/octet-stream',
      )
      response.setHeader('cache-control', 'no-store')
      if (url.pathname === '/sw.js') {
        const worker = await result.text()
        response.end(
          `${worker}\nself.addEventListener('message', event => { if (event.data === 'SWASK_TEST_VERSION') event.ports[0]?.postMessage(${currentVersion}); });\n`,
        )
      } else response.end(Buffer.from(await result.arrayBuffer()))
    })().catch(() => {
      response.statusCode = 502
      response.end('Production test proxy unavailable')
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing test server address')
  return {
    url: `http://127.0.0.1:${address.port}`,
    nextVersion: () => {
      version++
    },
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    },
  }
}
