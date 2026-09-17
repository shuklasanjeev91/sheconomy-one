import { describe, expect, it } from 'vitest'

import { resolveOnline } from '~/lib/connectivity/resolve-online'

describe('resolveOnline', () => {
  it('is offline when disconnected', () => {
    expect(resolveOnline({ isConnected: false, isInternetReachable: true })).toBe(false)
    expect(resolveOnline({ isConnected: false, isInternetReachable: false })).toBe(false)
    expect(resolveOnline({ isConnected: false, isInternetReachable: null })).toBe(false)
  })

  it('is online when the link is up even if reachability is false', () => {
    // Web NetInfo often reports unreachable while localhost / LAN still works.
    expect(resolveOnline({ isConnected: true, isInternetReachable: false })).toBe(true)
  })

  it('is online when connected and reachable/unknown', () => {
    expect(resolveOnline({ isConnected: true, isInternetReachable: true })).toBe(true)
    expect(resolveOnline({ isConnected: true, isInternetReachable: null })).toBe(true)
  })

  it('uses reachability only when link state is unknown', () => {
    expect(resolveOnline({ isConnected: null, isInternetReachable: false })).toBe(false)
    expect(resolveOnline({ isConnected: undefined, isInternetReachable: false })).toBe(false)
    expect(resolveOnline({ isConnected: null, isInternetReachable: true })).toBe(true)
    expect(resolveOnline({ isConnected: null, isInternetReachable: null })).toBe(true)
  })
})
