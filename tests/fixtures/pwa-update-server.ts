import { createServer } from 'node:http'

// Proxy the production build on a separate origin for each update journey.
// Only a worker version probe is appended; its real lifecycle code is retained.
export async function pwaUpdateServer(upstream: string) {
  let version = 1
  const server = createServer((request, response) => {
    void (async () => {
      const currentVersion = version
      const url = new URL(request.url ?? '/', upstream)
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
