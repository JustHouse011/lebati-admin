// @vitest-environment node
import { scryptSync } from 'node:crypto'
import type OpenAI from 'openai'
import { createAssistantHandler } from './handler'
import { generateAnswer, type ProviderInput } from './provider'
import type { Account } from './access'
import type { AssistantStore } from './store'
import { assistantTools, executeTool } from './tools'

function memoryStore(): AssistantStore {
  const entries = new Map<string, unknown>()
  const locks = new Map<string, string>()
  return {
    async get<T>(key: string) { return (entries.get(key) as T | undefined) ?? null },
    async put(key, value) { entries.set(key, value) },
    async remove(key) { entries.delete(key) },
    async quota() { return true },
    async lock(key, owner) {
      if (locks.has(key)) return false
      locks.set(key, owner)
      return true
    },
    async unlock(key, owner) { if (locks.get(key) === owner) locks.delete(key) },
  }
}

const password = 'test-account-passphrase'
const salt = '17'.repeat(16)
const passwordHash = salt + ':' + scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex')
const institutional = { username: 'institution', role: 'NSFAS Administrator', programmes: ['nsfas-tuition'] } as const
const accounts: Account[] = [
  { username: 'admin', role: 'Global Administrator', passwordHash },
  { ...institutional, programmes: [...institutional.programmes], passwordHash },
  { username: 'other', role: 'Global Administrator', passwordHash },
]
const env = { OPENAI_API_KEY: 'test-placeholder', LEBATI_AI_MODE: 'synthetic', LEBATI_AI_ACCOUNTS: JSON.stringify(accounts) }
const origin = 'https://lebati.test'
const url = origin + '/api/assistant'
const post = (body: object, cookie = '', from = origin) => new Request(url, {
  method: 'POST', headers: { origin: from, cookie, 'content-type': 'application/json' }, body: JSON.stringify(body),
})
const ask = (workspace = 'nsfas', question = 'Compare provincial spending') => ({ action: 'ask', workspace, question })
const silentAudit = () => {}
async function signIn(handler: ReturnType<typeof createAssistantHandler>, username = 'admin') {
  const response = await handler(post({ action: 'signIn', username, password }))
  expect(response.status).toBe(200)
  const cookie = response.headers.get('Set-Cookie')!
  expect(cookie).toContain('HttpOnly; SameSite=Strict')
  expect(cookie).toContain('; Secure')
  return cookie.split(';')[0]
}
const query = { institution: null, programme: null, from: null, to: null, area: null, category: null, classification: null }

describe('assistant endpoint', () => {
  it('reports missing credentials and refuses to use synthetic data in production mode', async () => {
    const generate = vi.fn()
    const unconfigured = createAssistantHandler({ env: {}, generate })
    expect(await (await unconfigured(new Request(url))).json()).toMatchObject({ state: 'unconfigured', message: expect.stringMatching(/OpenAI API key/) })
    const production = createAssistantHandler({ env: { ...env, LEBATI_AI_MODE: 'production' }, store: memoryStore(), generate })
    expect(await (await production(new Request(url))).json()).toMatchObject({ state: 'unconfigured', mode: 'production' })
    expect((await production(post(ask()))).status).toBe(503)
    expect(generate).not.toHaveBeenCalled()
  })

  it('requires a server session and ignores browser claims about role or workspace', async () => {
    const generate = vi.fn()
    const handler = createAssistantHandler({ env, store: memoryStore(), generate, audit: silentAudit })
    expect((await handler(post(ask(), '__Host-lebati_ai=' + 'x'.repeat(43)))).status).toBe(401)
    expect((await handler(post(ask(), '', 'https://another.test'))).status).toBe(403)
    expect((await handler(post({ action: 'signIn', username: 'institution', password: 'incorrect' }))).status).toBe(401)
    const cookie = await signIn(handler, 'institution')
    expect((await handler(post({ ...ask('sassa'), role: 'Global Administrator' }, cookie))).status).toBe(400)
    expect((await handler(post(ask('sassa'), cookie))).status).toBe(403)
    expect((await handler(post(ask('nsfas', 'Check this person: example@example.com'), cookie))).status).toBe(400)
    const logout = new Request(url, { method: 'DELETE', headers: { origin, cookie } })
    expect((await handler(logout)).headers.get('Set-Cookie')).toContain('Max-Age=0')
    expect((await handler(post(ask(), cookie))).status).toBe(401)
    expect(generate).not.toHaveBeenCalled()
  })

  it('streams answer fragments and isolates retained context by session and workspace', async () => {
    const generate = vi.fn(async ({ onDelta, onTools }: ProviderInput) => {
      onTools(['getDashboardSummary'])
      onDelta('Synthetic ')
      onDelta('results.')
      return 'Synthetic results.'
    })
    const handler = createAssistantHandler({ env, store: memoryStore(), generate, audit: silentAudit })
    const cookie = await signIn(handler)
    const response = await handler(post(ask(), cookie))
    expect(response.headers.get('Content-Type')).toMatch(/ndjson/)
    const frames = (await response.text()).trim().split('\n').map((line) => JSON.parse(line))
    expect(frames).toEqual([
      { type: 'tools', names: ['getDashboardSummary'] }, { type: 'delta', text: 'Synthetic ' }, { type: 'delta', text: 'results.' }, { type: 'done' },
    ])
    const getHistory = async (workspace: string, session: string) => {
      const result = await (await handler(post({ action: 'history', workspace }, session))).json() as { messages: unknown[] }
      return result.messages
    }
    expect(await getHistory('nsfas', cookie)).toHaveLength(2)
    expect(await getHistory('sassa', cookie)).toEqual([])
    expect(await getHistory('nsfas', await signIn(handler, 'other'))).toEqual([])
    expect((await handler(post({ action: 'reset', workspace: 'nsfas' }, cookie))).status).toBe(200)
    expect(await getHistory('nsfas', cookie)).toEqual([])
  })

  it('limits cost and discards failed or timed-out turns without revealing provider details', async () => {
    const store = memoryStore()
    const generate = vi.fn(async (_input: ProviderInput) => { throw new Error('internal provider details') })
    const rejected = createAssistantHandler({ env, store, generate, audit: silentAudit })
    const cookie = await signIn(rejected)
    const response = await rejected(post(ask(), cookie))
    expect(await response.text()).toContain('could not complete')
    expect(await (await rejected(post({ action: 'history', workspace: 'nsfas' }, cookie))).json()).toEqual({ messages: [] })

    const timeout = createAssistantHandler({ env, store, audit: silentAudit, timeoutMs: 5, generate: ({ signal }) =>
      new Promise((_resolve, reject) => {
        signal.throwIfAborted()
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
      }) })
    expect(await (await timeout(post(ask(), cookie))).text()).toContain('timed out')

    const quota = createAssistantHandler({ env, store: { ...store, quota: async () => false }, generate, audit: silentAudit })
    expect((await quota(post(ask(), cookie))).status).toBe(429)
    expect(generate).toHaveBeenCalledTimes(1)
  })
})

describe('assistant tools and provider', () => {
  const restricted = { ...institutional, programmes: [...institutional.programmes] }

  it('rejects injections, out-of-workspace tool calls, and invalid arguments', async () => {
    expect(await executeTool('executeSql', '{}', restricted, 'nsfas')).toEqual({ error: 'Invalid tool request' })
    expect(await executeTool('getDashboardSummary', JSON.stringify({ ...query, role: 'Global Administrator' }), restricted, 'nsfas')).toEqual({ error: 'Invalid tool arguments' })
    expect(await executeTool('getDashboardSummary', JSON.stringify(query), restricted, 'sassa')).toEqual({ error: 'Scope unavailable' })
    expect(await executeTool('getDashboardSummary', JSON.stringify({ ...query, institution: 'sassa' }), restricted, 'nsfas')).toMatchObject({ error: 'Institution unavailable in this scope' })
    expect(await executeTool('getCaseSummary', '{"id":"SASSA-REVIEW-001"}', restricted, 'nsfas')).toMatchObject({ case: null })
  })

  it('provides report provenance and numeric denominators for an authorised ranked result', async () => {
    const result = await executeTool('getGeographicRiskStatistics', JSON.stringify({
      ...query, institution: 'nsfas', level: 'town', measure: 'gamblingTransactionShare', from: '2026-08', to: '2026-10',
    }), restricted, 'nsfas')
    expect(result).toMatchObject({
      source: { status: 'Fictional synthetic records', freshness: 'Through October 2026' },
      denominators: { reviewRate: expect.stringContaining('1,000') },
      reportingPeriod: { from: '2026-08', through: '2026-10' },
      results: expect.arrayContaining([expect.objectContaining({ statistics: expect.objectContaining({ monitoredDistinctParticipants: expect.any(Number) }) })]),
    })
    if (!('results' in result) || !result.results?.length) throw new Error('No ranking result')
    const first = result.results[0] as { value: number; statistics: { gamblingTransactions: number; observedCategoryTransactions: number } }
    expect(first.value).toBeCloseTo(first.statistics.gamblingTransactions * 100 / first.statistics.observedCategoryTransactions)
  })

  it('limits case lookups to assigned agent grants', async () => {
    const account = { role: 'Agent', username: 'agent', grants: [{ programme: 'sassa-child', area: 'ZA' }], cases: ['SASSA-REVIEW-001'] } as const
    const agent = { ...account, grants: [...account.grants], cases: [...account.cases] }
    expect(await executeTool('getCaseSummary', '{"id":"SASSA-REVIEW-001"}', agent, 'sassa')).toMatchObject({ case: { status: 'Awaiting human review', missing: expect.any(Array) } })
    expect(await executeTool('getCaseSummary', '{"id":"SASSA-REVIEW-001"}', { ...agent, cases: [] }, 'sassa')).toMatchObject({ case: null })
  })

  it('passes strict read-only tool results to the Responses API and streams the second response', async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ status: 'completed', output: [{ type: 'function_call', name: 'getPolicyExplanation', call_id: 'call_1', arguments: '{"id":"case-review"}' }] })
      .mockResolvedValueOnce((async function* () {
        yield { type: 'response.output_text.delta', delta: 'Review the ' }
        yield { type: 'response.output_text.delta', delta: 'evidence.' }
        yield { type: 'response.completed' }
      })())
    const parts: string[] = []
    const answer = await generateAnswer({
      apiKey: 'test-placeholder', account: restricted, workspace: 'nsfas', signal: new AbortController().signal,
      history: [{ role: 'user', content: 'How do I review evidence?' }], onDelta: (text) => parts.push(text), onTools: () => {},
    }, { responses: { create } } as unknown as OpenAI)
    expect(answer).toBe(parts.join(''))
    expect(create.mock.calls[0][0]).toMatchObject({ tool_choice: 'required', store: false })
    expect(create.mock.calls[1][0]).toMatchObject({ stream: true, tool_choice: 'none', store: false })
    const toolResult = create.mock.calls[1][0].input.find((item: { type: string }) => item.type === 'function_call_output')
    expect(JSON.parse(toolResult.output)).toMatchObject({ document: { id: 'case-review' } })
    expect(assistantTools.every(({ strict, parameters }) => strict && parameters.additionalProperties === false)).toBe(true)
  })
})
