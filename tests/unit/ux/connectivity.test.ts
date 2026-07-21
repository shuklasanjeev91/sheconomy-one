import { describe, expect, it } from 'vitest'

import { resolveOnline } from '~/lib/connectivity/resolve-online'

describe('resolveOnline', () => {
  it('is offline when disconnected', () => {
    expect(resolveOnline({ isConnected: false, isInternetReachable: true })).toBe(false)
  })

  it('is offline when internet is unreachable', () => {
    expect(resolveOnline({ isConnected: true, isInternetReachable: false })).toBe(false)
  })

  it('is online when connected and reachable/unknown', () => {
    expect(resolveOnline({ isConnected: true, isInternetReachable: true })).toBe(true)
    expect(resolveOnline({ isConnected: true, isInternetReachable: null })).toBe(true)
  })
})
