const DEFAULT_SHEAI_ORIGIN = 'http://18.138.34.238:8000'

function sheaiOrigin(): string {
  const fromEnv = (typeof process !== 'undefined' ? process.env.SHEAI_API_URL : '')?.trim()
  return (fromEnv || DEFAULT_SHEAI_ORIGIN).replace(/\/$/, '')
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ detail: 'Invalid JSON' }, { status: 400 })
  }

  const payload = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const searchQuery = typeof payload.search_query === 'string' ? payload.search_query.trim() : ''
  if (!searchQuery) {
    return Response.json({ detail: 'search_query is required' }, { status: 400 })
  }

  const topK = typeof payload.top_k === 'number' && Number.isFinite(payload.top_k) ? payload.top_k : 10

  try {
    const upstream = await fetch(`${sheaiOrigin()}/recommend/rich`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search_query: searchQuery, top_k: topK }),
    })
    const text = await upstream.text()
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reach SHEai'
    return Response.json({ detail: message }, { status: 502 })
  }
}
