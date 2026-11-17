import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  currentSession, establishSession, parseAccounts, permittedWorkspaces, revokeSession, sessionCookie, sessionToken, verifyPassword, workspaceSchema,
} from './access.js'
import { generateAnswer, providerFailureMessage, type Message, type ProviderInput } from './provider.js'
import { fingerprint, redisStore, type AssistantStore } from './store.js'

const historySeconds = 30 * 60
// This is a conservative block for common identifiers. Fictional datasets never contain person-level records.
const sensitiveIdentifier = /[\w.+%-]+@[\w.-]+\.[a-z]{2,}|\b\d{10,}\b|(?:\+27|\b0)(?:[ -]?\d){9}\b/i
const requestSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('signIn'), username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{2,64}$/), password: z.string().min(1).max(200) }).strict(),
  z.object({ action: z.literal('history'), workspace: workspaceSchema }).strict(),
  z.object({ action: z.literal('reset'), workspace: workspaceSchema }).strict(),
  z.object({ action: z.literal('ask'), workspace: workspaceSchema, question: z.string().trim().min(1).max(1200) }).strict(),
])
type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'tools'; names: string[] }
  | { type: 'done' }
  | { type: 'error'; message: string }

type Dependencies = {
  env?: NodeJS.ProcessEnv
  store?: AssistantStore
  generate?: (input: ProviderInput) => Promise<string>
  audit?: (entry: Record<string, unknown>) => void
  timeoutMs?: number
}

function headers(extra: Record<string, string> = {}) {
  return { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra }
}
function json(data: object, status = 200, extra: Record<string, string> = {}) {
  return Response.json(data, { status, headers: headers(extra) })
}
function message(error: string, status: number, extra?: Record<string, string>) {
  return json({ error }, status, extra)
}
async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.split(';')[0].trim().match(/^application\/json$/i) || !request.body) throw new Error('Invalid body')
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let text = '', bytes = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      if (bytes > 8192) { await reader.cancel(); throw new Error('Body too large') }
      text += decoder.decode(value, { stream: true })
    }
    return JSON.parse(text + decoder.decode()) as unknown
  } finally { reader.releaseLock() }
}

export function createAssistantHandler(dependencies: Dependencies = {}) {
  const env = dependencies.env ?? process.env
  const accounts = parseAccounts(env.LEBATI_AI_ACCOUNTS)
  const apiKey = env.OPENAI_API_KEY?.trim()
  const url = env.LEBATI_AI_REDIS_URL || env.UPSTASH_REDIS_REST_URL
  const token = env.LEBATI_AI_REDIS_TOKEN || env.UPSTASH_REDIS_REST_TOKEN
  const recordAudit = dependencies.audit ?? ((entry) => console.info(JSON.stringify({ system: 'lebati-ai', at: new Date().toISOString(), ...entry })))
  const generate = dependencies.generate ?? generateAnswer
  let store = dependencies.store
  const configMessage = env.LEBATI_AI_MODE === 'production'
    ? 'Live institutional data access is awaiting approval and configuration.'
    : !apiKey ? 'The server OpenAI API key is not configured.'
      : env.LEBATI_AI_MODE !== 'synthetic' || !accounts || (!store && (!url?.startsWith('https://') || !token))
        ? 'The assistant requires synthetic mode, server accounts and a rate-limit store.' : null

  return async function handle(request: Request): Promise<Response> {
    const requestId = request.headers.get('x-lebati-request-id') ?? randomUUID()
    const audit = (entry: Record<string, unknown>) => recordAudit({ ...entry, requestId })
    const origin = new URL(request.url)
    const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname)
    if (origin.protocol !== 'https:' && !loopback) return message('HTTPS is required.', 403)
    if (!['GET', 'POST', 'DELETE'].includes(request.method)) return message('Method not allowed.', 405, { Allow: 'GET, POST, DELETE' })
    if (request.method !== 'GET' && request.headers.get('origin') !== origin.origin) return message('Request origin denied.', 403)
    if (configMessage || !apiKey || !accounts) {
      if (request.method === 'POST' && new URL(request.url).pathname === '/api/ai/chat' && !sessionToken(request)) {
        return message('Sign in to Lebati AI first.', 401)
      }
      if (request.method === 'DELETE') return json({ state: 'unconfigured' }, 200, { 'Set-Cookie': sessionCookie(request) })
      return request.method === 'GET'
        ? json({ state: 'unconfigured', message: configMessage, mode: env.LEBATI_AI_MODE === 'production' ? 'production' : 'synthetic' })
        : message(configMessage ?? 'The assistant is not configured.', 503)
    }
    try {
      const stateStore = store ??= redisStore(url!, token!)
      if (request.method === 'DELETE') {
        await revokeSession(request, stateStore)
        return json({ state: 'locked' }, 200, { 'Set-Cookie': sessionCookie(request) })
      }
      if (request.method === 'GET') {
        const session = await currentSession(request, stateStore, accounts)
        return session
          ? json({ state: 'ready', mode: 'synthetic', workspaces: permittedWorkspaces(session.account) })
          : json({ state: 'locked', mode: 'synthetic' })
      }
      const body = requestSchema.safeParse(await readJson(request).catch(() => null))
      if (!body.success) return message('Invalid request.', 400)
      const command = body.data
      if (command.action === 'signIn') {
        const ip = loopback ? 'local' : request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim() || 'unknown'
        if (!await stateStore.quota('signin:ip:' + fingerprint(ip), 300, 12) ||
            !await stateStore.quota('signin:account:' + fingerprint(command.username), 300, 8)) {
          return message('Too many sign-in attempts. Try again in five minutes.', 429, { 'Retry-After': '300' })
        }
        const account = await verifyPassword(command.username, command.password, accounts)
        audit({ event: 'sign_in', account: fingerprint(command.username).slice(0, 16), outcome: account ? 'verified' : 'denied' })
        if (!account) return message('The assistant credentials were not accepted.', 401)
        return json({ state: 'ready', mode: 'synthetic' }, 200, { 'Set-Cookie': await establishSession(request, stateStore, account) })
      }

      const session = await currentSession(request, stateStore, accounts)
      if (!session) return message('Sign in to Lebati AI first.', 401)
      if (!permittedWorkspaces(session.account).includes(command.workspace)) return message('This workspace is outside your assistant access.', 403)
      if (command.action === 'ask' && sensitiveIdentifier.test(command.question)) {
        return message('Remove personal or financial identifiers before asking the assistant.', 400)
      }
      const key = 'conversation:' + session.key + ':' + command.workspace
      if (command.action === 'history') return json({ messages: await stateStore.get<Message[]>(key) ?? [] })

      const owner = randomUUID()
      const lock = key + ':lock'
      if (!await stateStore.lock(lock, owner, 55)) return message('A response is already in progress in this workspace.', 409)
      if (command.action === 'reset') {
        try { await stateStore.remove(key); return json({ messages: [] }) }
        finally { await stateStore.unlock(lock, owner) }
      }

      const actor = fingerprint(session.account.username)
      const timeout = AbortSignal.timeout(dependencies.timeoutMs ?? 42_000)
      const client = new AbortController()
      const signal = AbortSignal.any([request.signal, timeout, client.signal])
      try {
        if (!await stateStore.quota('requests:minute:' + actor, 60, 6) ||
            !await stateStore.quota('requests:day:' + actor, 86_400, 60) ||
            !await stateStore.quota('requests:global', 86_400, 240)) {
          await stateStore.unlock(lock, owner)
          return message('The assistant request limit has been reached. Try again later.', 429)
        }
        const history = await stateStore.get<Message[]>(key) ?? []
        const input: Message[] = [...history.slice(-8), { role: 'user', content: command.question }]
        const encoder = new TextEncoder()
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            const send = (event: StreamEvent) => { if (!request.signal.aborted && !client.signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')) }
            const tools = new Set<string>()
            let outcome = 'error'
            try {
              const answer = await generate({
                apiKey, history: input, account: session.account, workspace: command.workspace, signal,
                onDelta: (text) => send({ type: 'delta', text }),
                onTools: (names) => { names.forEach((name) => tools.add(name)); send({ type: 'tools', names }) },
              })
              signal.throwIfAborted()
              if (!await currentSession(request, stateStore, accounts)) throw new Error('Session revoked')
              await stateStore.put(key, [...input, { role: 'assistant', content: answer.slice(0, 6000) }], historySeconds)
              outcome = 'completed'
              send({ type: 'done' })
            } catch (error) {
              outcome = timeout.aborted ? 'timeout' : signal.aborted ? 'cancelled' : 'error'
              send({ type: 'error', message: timeout.aborted ? 'The assistant timed out. Try a narrower question.' : providerFailureMessage(error) })
            } finally {
              audit({ event: 'answer', account: actor.slice(0, 16), role: session.account.role, workspace: command.workspace, tools: [...tools], outcome })
              await stateStore.unlock(lock, owner).catch(() => {})
              if (!client.signal.aborted) controller.close()
            }
          },
          cancel() { client.abort() },
        })
        return new Response(stream, { headers: headers({ 'Content-Type': 'application/x-ndjson; charset=utf-8' }) })
      } catch {
        await stateStore.unlock(lock, owner).catch(() => {})
        return message('The assistant is temporarily unavailable.', 503)
      }
    } catch {
      return message('The assistant is temporarily unavailable.', 503)
    }
  }
}
