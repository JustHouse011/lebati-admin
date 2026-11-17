import { Bot, MessageSquarePlus, Send, Square, X } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import type { GeoWorkspace } from '../geography/geographicRisk'
import { AssistantContext } from './assistantContext'

type Message = { role: 'user' | 'assistant'; content: string }
type Status = { state: 'unconfigured' | 'locked' | 'ready'; message?: string; workspaces?: GeoWorkspace[] }
type StreamEvent = { type: 'delta'; text: string } | { type: 'done' } | { type: 'error'; message: string } | { type: 'tools'; names: string[] }
const workspaceNames = { global: 'Global', nsfas: 'NSFAS', sassa: 'SASSA' }
const questions: Record<GeoWorkspace, string[]> = {
  global: ['Compare Gauteng and KwaZulu-Natal.', 'How do I review a flagged transaction?', 'How does the restriction lifecycle work?'],
  nsfas: ['Which province has the highest gambling-related spend?', 'Which town has the highest gambling transaction share?', 'Show monthly student spending trends.'],
  sassa: ['Show spending-risk trends over the last six available months.', 'Which municipality has the largest increase in flags?', 'Explain financial wellness referrals.'],
}

async function request(body?: object, signal?: AbortSignal, method = body ? 'POST' : 'GET') {
  const response = await fetch('/api/assistant', {
    method, signal, credentials: 'same-origin',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => ({ error: 'The assistant is unavailable.' }))
    throw new Error(typeof result.error === 'string' ? result.error : 'The assistant is unavailable.')
  }
  return response
}

async function streamAnswer(response: Response, onEvent: (event: StreamEvent) => void) {
  if (!response.body || !response.headers.get('content-type')?.includes('application/x-ndjson')) throw new Error('The assistant did not return a response stream.')
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = '', completed = false
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += value
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        const event = JSON.parse(line) as StreamEvent
        if (event.type === 'error') throw new Error(event.message)
        if (event.type === 'done') completed = true
        onEvent(event)
      }
    }
    if (!completed || buffer.trim()) throw new Error('The response was interrupted.')
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}

function AssistantPanel({ workspace, initial, onClose }: { workspace: GeoWorkspace; initial: string; onClose: () => void }) {
  const title = useId()
  const [status, setStatus] = useState<Status | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState(initial)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const requestRef = useRef<AbortController | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const historyRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async (signal: AbortSignal) => {
    const next = await (await request(undefined, signal)).json() as Status
    if (next.state === 'ready' && next.workspaces?.includes(workspace)) {
      const history = await (await request({ action: 'history', workspace }, signal)).json() as { messages: Message[] }
      setMessages(history.messages)
    }
    setStatus(next)
  }, [workspace])
  useEffect(() => {
    const controller = new AbortController()
    closeRef.current?.focus()
    void load(controller.signal).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The assistant could not be reached.')
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); requestRef.current?.abort() }
  }, [load])
  useEffect(() => {
    if (historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight
  }, [messages, draft])

  const sessionAction = async (body?: object, method?: string) => {
    if (requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request(body, controller.signal, method)
      if (method === 'DELETE') { setMessages([]); setDraft(''); setStatus({ state: 'locked' }) }
      else if (body && 'action' in body && body.action === 'reset') { setMessages([]); setDraft(''); setQuestion('') }
      else await load(controller.signal)
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'The request failed.')
    } finally {
      requestRef.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  const signIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    event.currentTarget.reset()
    void sessionAction({ action: 'signIn', username: values.get('username'), password: values.get('password') })
  }

  const ask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const prompt = question.trim()
    if (!prompt || requestRef.current) return
    const controller = new AbortController()
    requestRef.current = controller
    setBusy(true)
    setQuestion('')
    setGenerating(true)
    setDraft('')
    setError('')
    setNotice('Checking authorised sources…')
    const userMessage: Message = { role: 'user', content: prompt }
    setMessages((history) => [...history, userMessage])
    let answer = ''
    try {
      const response = await request({ action: 'ask', workspace, question: prompt }, controller.signal)
      await streamAnswer(response, (item) => {
        if (!controller.signal.aborted && item.type === 'delta') {
          answer += item.text
          setDraft(answer)
          setNotice('Writing response…')
        }
      })
      controller.signal.throwIfAborted()
      setMessages((history) => [...history, { role: 'assistant', content: answer }])
      setNotice('')
    } catch (cause) {
      setMessages((history) => history.filter((entry) => entry !== userMessage))
      setQuestion(prompt)
      if (controller.signal.aborted) setNotice('Response stopped.')
      else {
        setNotice('')
        setError(cause instanceof Error ? cause.message : 'The assistant could not complete this response.')
        const current = await request(undefined, controller.signal).then((response) => response.json() as Promise<Status>).catch(() => null)
        if (current?.state === 'locked') setStatus(current)
      }
    } finally {
      requestRef.current = null
      setDraft('')
      setBusy(false)
      setGenerating(false)
    }
  }
  const stop = () => {
    requestRef.current?.abort()
    setDraft('')
    setNotice('Response stopped.')
  }
  const ready = status?.state === 'ready' && status.workspaces?.includes(workspace)

  return <section role="dialog" aria-labelledby={title} onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}
    className="settings-card fixed inset-x-2 bottom-2 z-50 flex h-[min(720px,calc(100dvh-1rem))] flex-col overflow-hidden border-t-4 border-t-gold !p-0 shadow-2xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[min(32rem,calc(100vw-3rem))]">
    <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div><h2 id={title} className="flex items-center gap-2 text-lg"><Bot size={20} className="text-[#a47b36]" aria-hidden="true" /> Lebati AI</h2>
        <p className="mt-1 text-xs opacity-75">{workspaceNames[workspace]} workspace · Read-only</p></div>
      <div className="flex gap-2">
        {ready && <button type="button" aria-label="New conversation" title="New conversation" className="settings-button secondary !p-2" disabled={busy}
          onClick={() => void sessionAction({ action: 'reset', workspace })}><MessageSquarePlus size={17} /></button>}
        <button ref={closeRef} type="button" aria-label="Close Lebati AI" className="settings-button secondary !p-2" onClick={onClose}><X size={17} /></button>
      </div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={historyRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {loading && <p role="status" className="text-sm">Checking assistant access…</p>}
        {!loading && status?.state === 'unconfigured' && <div className="rounded-xl border border-gold/60 p-4 text-sm leading-relaxed">
          <p><strong>Assistant setup required</strong></p><p className="mt-2">{status.message}</p>
        </div>}
        {!loading && !status && <p className="text-sm">Assistant access is unavailable. Close the panel and try again.</p>}
        {status?.state === 'locked' && <form onSubmit={signIn} className="space-y-3">
          <p className="text-sm">Enter your assistant account credentials to access fictional workspace records.</p>
          <label className="grid gap-1 text-sm">Assistant username<input className="settings-input" name="username" autoComplete="username" maxLength={64} required /></label>
          <label className="grid gap-1 text-sm">Assistant password<input type="password" className="settings-input" name="password" autoComplete="current-password" maxLength={200} required /></label>
          <button type="submit" className="settings-button" disabled={busy}>Unlock assistant</button>
        </form>}
        {status?.state === 'ready' && !ready && <p className="text-sm">Your assistant account has no access to this workspace. Switch to an authorised workspace.</p>}
        {ready && <>
          <p className="text-xs leading-relaxed opacity-75">Fictional records and portal guidance. Keep personal or confidential information out of your questions.</p>
          {!messages.length && <div className="flex flex-wrap gap-2">
            {questions[workspace].map((item) => <button key={item} type="button" className="settings-button secondary text-left" onClick={() => setQuestion(item)}>{item}</button>)}
          </div>}
          {[...messages, ...(draft ? [{ role: 'assistant' as const, content: draft }] : [])].map(({ role, content }, index) =>
            <article key={index} aria-label={role === 'user' ? 'Your message' : 'Assistant response'} className={`min-w-0 break-words rounded-xl border border-slate-200 px-3 py-2 text-sm leading-relaxed ${role === 'user' ? 'ml-6 bg-teal/10' : 'assistant-markdown mr-3'}`}>
              {role === 'user' ? <p className="whitespace-pre-wrap">{content}</p> :
                <ReactMarkdown skipHtml disallowedElements={['img', 'a']} unwrapDisallowed>{content}</ReactMarkdown>}
            </article>)}
        </>}
        {notice && <p role="status" className="text-xs opacity-75">{notice}</p>}
        {error && <p role="alert" className="rounded-xl border border-red-500/40 p-3 text-sm">{error}</p>}
      </div>
      {ready && <form onSubmit={(event) => void ask(event)} className="space-y-2 border-t border-slate-200 p-3">
        <label className="grid gap-1 text-xs">Ask Lebati AI<textarea className="settings-input min-h-16 resize-y" rows={2} value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1200} /></label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" disabled={busy} className="text-xs underline disabled:opacity-40" onClick={() => void sessionAction(undefined, 'DELETE')}>Lock assistant</button>
          {generating ? <button type="button" className="settings-button secondary" onClick={stop}><Square size={14} aria-hidden="true" /> Stop</button> :
            <button type="submit" className="settings-button" disabled={busy || !question.trim()}><Send size={15} aria-hidden="true" /> Send</button>}
        </div>
      </form>}
    </div>
  </section>
}

export default function AssistantProvider({ workspace, children }: { workspace: GeoWorkspace; children: ReactNode }) {
  const [panel, setPanel] = useState<{ initial: string; version: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const open = (question = '') => setPanel((previous) => ({ initial: question, version: (previous?.version ?? 0) + 1 }))
  const close = () => { setPanel(null); requestAnimationFrame(() => trigger.current?.focus()) }
  return <AssistantContext.Provider value={open}>
    {children}
    {!panel && <button ref={trigger} type="button" aria-haspopup="dialog" aria-expanded={false} onClick={() => open()}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-gold bg-navy px-4 py-3 text-sm text-white shadow-lg focus-visible:outline-2 focus-visible:outline-gold sm:bottom-6 sm:right-6">
      <Bot className="text-gold" size={19} aria-hidden="true" /> Lebati AI
    </button>}
    {panel && <AssistantPanel key={workspace + panel.version} workspace={workspace} initial={panel.initial} onClose={close} />}
  </AssistantContext.Provider>
}
