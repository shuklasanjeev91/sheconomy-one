'use strict'

/**
 * Verifies the HS256 meeting token minted by the `mediasoup-token` Supabase
 * function. Copied next to `server/lib/WsServer.js` on the mediasoup host and
 * required from there; see `WsServer.patch` in this directory.
 */

const crypto = require('node:crypto')

const APP_ROOM_PREFIX = 'sc_'
const CLOCK_SKEW_SECONDS = 60

function isAppRoom(roomId) {
  return typeof roomId === 'string' && roomId.startsWith(APP_ROOM_PREFIX)
}

function decodeSegment(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
}

/**
 * @returns {{ ok: true, claims: Record<string, unknown> } | { ok: false, reason: string }}
 */
function verifyMeetingToken(token, { secret, roomId, peerId, nowSeconds }) {
  if (!secret) return { ok: false, reason: 'server secret not configured' }
  if (typeof token !== 'string' || !token) return { ok: false, reason: 'missing token' }

  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed token' }
  const [headerPart, bodyPart, signaturePart] = parts

  let header
  let claims
  try {
    header = decodeSegment(headerPart)
    claims = decodeSegment(bodyPart)
  } catch {
    return { ok: false, reason: 'malformed token' }
  }
  if (!header || header.alg !== 'HS256') return { ok: false, reason: 'unsupported algorithm' }

  const expected = crypto.createHmac('sha256', secret).update(`${headerPart}.${bodyPart}`).digest()
  const actual = Buffer.from(signaturePart, 'base64url')
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return { ok: false, reason: 'bad signature' }
  }

  const now = nowSeconds ?? Math.floor(Date.now() / 1000)
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < now) {
    return { ok: false, reason: 'token expired' }
  }
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_SECONDS > now) {
    return { ok: false, reason: 'token not yet valid' }
  }
  if (claims.room !== roomId) return { ok: false, reason: 'room mismatch' }
  if (claims.peer !== peerId) return { ok: false, reason: 'peer mismatch' }

  return { ok: true, claims }
}

/**
 * App rooms (`sc_*`) require a valid token once `MEDIASOUP_JWT_SECRET` is set;
 * a valid token also stands in for the browser Origin check, since native
 * clients do not send the web origin. Other rooms keep the demo behaviour.
 *
 * @returns {{ decision: 'token', claims: Record<string, unknown> } | { decision: 'origin' } | { decision: 'reject', status: number, reason: string }}
 */
function authorizeConnection({ roomId, peerId, token, secret, nowSeconds }) {
  if (!secret || !isAppRoom(roomId)) return { decision: 'origin' }
  const result = verifyMeetingToken(token, { secret, roomId, peerId, nowSeconds })
  if (!result.ok) return { decision: 'reject', status: 401, reason: result.reason }
  return { decision: 'token', claims: result.claims }
}

module.exports = { APP_ROOM_PREFIX, isAppRoom, verifyMeetingToken, authorizeConnection }
