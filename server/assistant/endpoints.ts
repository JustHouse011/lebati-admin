import { randomUUID } from 'node:crypto'

export function endpoint(handler: (request: Request) => Promise<Response>, route: 'chat' | 'session' | 'legacy') {
  return async (request: Request) => {
    const requestId = randomUUID()
    const respond = (data: object, status: number, extra: Record<string, string> = {}) =>
      Response.json({ ...data, requestId }, { status, headers: {
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Request-Id': requestId, ...extra,
      } })
    const methods = route === 'chat' ? ['POST'] : ['GET', 'POST', 'DELETE']
    if (!methods.includes(request.method)) return respond({ error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, 405, { Allow: methods.join(', ') })
    if (route === 'chat' || (route === 'session' && request.method === 'POST')) {
      const length = Number(request.headers.get('content-length'))
      if (length > 8192) return respond({ error: 'The request is too large.', code: 'REQUEST_TOO_LARGE' }, 413)
      let body = ''
      const reader = request.body?.getReader()
      if (!reader) return respond({ error: 'A JSON request is required.', code: 'INVALID_REQUEST' }, 400)
      try {
        const decoder = new TextDecoder()
        let bytes = 0
        for (;;) {
          const chunk = await reader.read()
          if (chunk.done) break
          bytes += chunk.value.byteLength
          if (bytes > 8192) {
            await reader.cancel()
            return respond({ error: 'The request is too large.', code: 'REQUEST_TOO_LARGE' }, 413)
          }
          body += decoder.decode(chunk.value, { stream: true })
        }
        body += decoder.decode()
        const json = JSON.parse(body) as { action?: string }
        const actions = route === 'chat' ? ['ask', 'history', 'reset'] : ['signIn']
        if (!json || !actions.includes(json.action ?? '')) return respond({ error: 'Invalid request action.', code: 'INVALID_REQUEST' }, 400)
      } catch { return respond({ error: 'A valid JSON request is required.', code: 'INVALID_REQUEST' }, 400) }
      finally { reader.releaseLock() }
      request = new Request(request.url, { method: request.method, headers: request.headers, body, signal: request.signal })
    }
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-lebati-request-id', requestId)
    request = new Request(request, { headers: requestHeaders })
    try {
      const response = await handler(request)
      const headers = new Headers(response.headers)
      headers.set('X-Request-Id', requestId)
      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json() as Record<string, unknown>
        if (!response.ok && !data.code) {
          data.code = ({ 400: 'INVALID_REQUEST', 401: 'AUTHENTICATION_REQUIRED', 403: 'WORKSPACE_DENIED', 409: 'RESPONSE_IN_PROGRESS', 429: 'RATE_LIMITED', 503: 'SERVICE_UNAVAILABLE' } as Record<number, string>)[response.status] ?? 'REQUEST_FAILED'
        }
        return Response.json({ ...data, requestId }, { status: response.status, headers })
      }
      return new Response(response.body, { status: response.status, headers })
    } catch {
      console.error(JSON.stringify({ system: 'lebati-ai', event: 'endpoint_failure', requestId }))
      return respond({ error: 'The assistant service could not be reached. Try again later.', code: 'SERVICE_UNAVAILABLE' }, 503)
    }
  }
}
