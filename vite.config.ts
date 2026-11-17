import { fileURLToPath, URL } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'

function assistantApi(mode: string): Plugin {
  return {
    name: 'lebati-assistant-api',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), '')
      server.middlewares.use(async (req, res, next) => {
        const pathname = req.url?.split('?')[0]
        if (!['/api/assistant', '/api/ai/chat', '/api/ai/session'].includes(pathname ?? '')) return next()
        const abort = new AbortController()
        res.once('close', () => abort.abort())
        try {
          const { createAssistantHandler } = await server.ssrLoadModule('/server/assistant/handler.ts') as {
            createAssistantHandler(options: { env: NodeJS.ProcessEnv }): (request: Request) => Promise<Response>
          }
          const { endpoint } = await server.ssrLoadModule('/server/assistant/endpoints.ts') as {
            endpoint(handler: (request: Request) => Promise<Response>, route: 'chat' | 'session' | 'legacy'): (request: Request) => Promise<Response>
          }
          const requestHeaders = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (value) requestHeaders.set(key, Array.isArray(value) ? value.join(', ') : value)
          }
          const request = new Request('http://' + req.headers.host + pathname, {
            method: req.method, headers: requestHeaders, signal: abort.signal,
            ...(req.method === 'POST' ? { body: Readable.toWeb(req), duplex: 'half' as const } : {}),
          })
          const route = pathname === '/api/ai/chat' ? 'chat' : pathname === '/api/ai/session' ? 'session' : 'legacy'
          const response = await endpoint(createAssistantHandler({ env }), route)(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          if (response.body) await pipeline(Readable.fromWeb(response.body), res)
          else res.end()
        } catch {
          if (!res.headersSent) {
            res.statusCode = 503
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'The assistant API is unavailable.' }))
          } else if (!res.destroyed) res.destroy()
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), assistantApi(mode)],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
}))
