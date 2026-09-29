import { describe, expect, it, vi } from 'vitest'

import {
  describeLiveKitConnectError,
  isLiveKitRoomConnectError,
  LIVEKIT_ACCESS_EXPIRED_MESSAGE,
  LIVEKIT_UNREACHABLE_MESSAGE,
  LIVEKIT_USAGE_LIMIT_MESSAGE,
  liveKitConnectErrorMessage,
} from '../../../co-work/lib/livekit-connect-error'

function connectionError(message: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(message), { name: 'ConnectionError', ...extra })
}

const credentials = { serverUrl: 'wss://demo.livekit.cloud', token: 'tok' }

describe('LiveKit connect errors', () => {
  it('only treats room connection failures as fatal', () => {
    expect(isLiveKitRoomConnectError(connectionError('ws failed', { reason: 2 }))).toBe(true)
    expect(isLiveKitRoomConnectError(new Error('no livekit url provided'))).toBe(true)
    expect(isLiveKitRoomConnectError(connectionError('left', { reason: 3 }))).toBe(false)
    expect(isLiveKitRoomConnectError(new DOMException('Denied', 'NotAllowedError'))).toBe(false)
    expect(isLiveKitRoomConnectError('oops')).toBe(false)
  })

  it('maps quota, auth, and network failures to clear copy', () => {
    expect(liveKitConnectErrorMessage({ status: 429 })).toBe(LIVEKIT_USAGE_LIMIT_MESSAGE)
    expect(
      liveKitConnectErrorMessage({ detail: 'bandwidth usage exceeded. please contact the project owner.' }),
    ).toBe(LIVEKIT_USAGE_LIMIT_MESSAGE)
    expect(liveKitConnectErrorMessage({ status: 401 })).toBe(LIVEKIT_ACCESS_EXPIRED_MESSAGE)
    expect(liveKitConnectErrorMessage({ status: 200 })).toBe(LIVEKIT_UNREACHABLE_MESSAGE)
  })

  it('uses the status on the error without probing the server', async () => {
    const fetchImpl = vi.fn()
    const message = await describeLiveKitConnectError(
      connectionError('unknown websocket error', { context: { status: 429 } }),
      credentials,
      fetchImpl as unknown as typeof fetch,
    )
    expect(message).toBe(LIVEKIT_USAGE_LIMIT_MESSAGE)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('probes the validate endpoint when the websocket hides the reason', async () => {
    const fetchImpl = vi.fn(async () => new Response('bandwidth usage exceeded.', { status: 429 }))
    const message = await describeLiveKitConnectError(
      connectionError('could not establish signal connection'),
      credentials,
      fetchImpl as unknown as typeof fetch,
    )
    expect(message).toBe(LIVEKIT_USAGE_LIMIT_MESSAGE)
    expect(fetchImpl).toHaveBeenCalledWith('https://demo.livekit.cloud/rtc/validate?access_token=tok')
  })

  it('falls back to the network message when the probe fails', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const message = await describeLiveKitConnectError(
      connectionError('could not establish signal connection'),
      credentials,
      fetchImpl as unknown as typeof fetch,
    )
    expect(message).toBe(LIVEKIT_UNREACHABLE_MESSAGE)
  })
})
