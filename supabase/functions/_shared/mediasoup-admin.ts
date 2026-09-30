/** mediasoup rooms created for the app; the server only accepts tokens for this prefix. */
export const MEDIASOUP_ROOM_PREFIX = 'sc_'

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return new Uint8Array(Array.from(atob(padded), (char) => char.charCodeAt(0)))
}

function hmacKey(secret: string, usage: 'sign' | 'verify') {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage],
  )
}

export async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = base64Url(encoder.encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret, 'sign'),
    encoder.encode(`${header}.${body}`),
  )
  return `${header}.${body}.${base64Url(new Uint8Array(signature))}`
}

/** HS256 verify + expiry check; returns the payload or null. */
export async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const [header, body, signature] = token.split('.')
  if (!secret || !header || !body || !signature) return null
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret, 'verify'),
      fromBase64Url(signature),
      new TextEncoder().encode(`${header}.${body}`),
    )
    if (!valid) return null
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as Record<string, unknown>
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

/** Admin calls share the signalling port; a 60s token scopes each call. */
export async function mediasoupAdmin<T = Record<string, unknown>>(
  path: string,
  body: Record<string, unknown>,
): Promise<{ status: number; data: T | null }> {
  const mediasoupUrl = Deno.env.get('MEDIASOUP_URL')
  const jwtSecret = Deno.env.get('MEDIASOUP_JWT_SECRET')
  if (!mediasoupUrl || !jwtSecret) throw new Error('mediasoup is not configured.')
  const now = Math.floor(Date.now() / 1000)
  const token = await signJwt({ adm: true, path, iat: now, exp: now + 60 }, jwtSecret)
  const base = mediasoupUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/+$/, '')
  const response = await fetch(`${base}/admin/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => null)) as T | null
  return { status: response.status, data }
}
