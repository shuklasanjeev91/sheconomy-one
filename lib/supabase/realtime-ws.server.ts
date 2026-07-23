import WS from 'ws'

/**
 * SSR (Vercel / Node): supabase-js Realtime requires a WebSocket constructor.
 * Node 18/20 has none; Node 22+ has global WebSocket. `ws` covers both.
 */
export function getRealtimeTransport(): typeof WebSocket | undefined {
  if (typeof globalThis.WebSocket !== 'undefined') return undefined
  return WS as unknown as typeof WebSocket
}
