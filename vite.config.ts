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
      server.middlewares.use('/api/assistant', async (req, res) => {
        const abort = new AbortController()
        res.once('close', () => abort.abort())
        try {
          const { createAssistantHandler } = await server.ssrLoadModule('/server/assistant/handler.ts') as {
            createAssistantHandler(options: { env: NodeJS.ProcessEnv }): (request: Request) => Promise<Response>
          }
          const requestHeaders = new Headers()
          for (const [key, value] of Object.entries(req.headers)) {
            if (value) requestHeaders.set(key, Array.isArray(value) ? value.join(', ') : value)
          }
          const request = new Request('http://' + req.headers.host + '/api/assistant', {
            method: req.method, headers: requestHeaders, signal: abort.signal,
            ...(req.method === 'POST' ? { body: Readable.toWeb(req), duplex: 'half' as const } : {}),
          })
          const response = await createAssistantHandler({ env })(request)
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
