import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('~/lib/gender-verification/return-to-storage', () => ({
  rememberVerificationReturnTo: vi.fn(),
}))

vi.mock('~/lib/gender-verification/verification-flow-storage', () => ({
  markVerificationFlowOpen: vi.fn(),
}))

import {
  consumeHumanVerificationHref,
  openHumanVerification,
  subscribeHumanVerificationOpen,
} from '~/lib/gender-verification/open-request'

describe('human verification open request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('notifies subscribers when openHumanVerification is called', () => {
    const spy = vi.fn()
    const unsubscribe = subscribeHumanVerificationOpen(spy)
    openHumanVerification({ returnTo: '/community' })
    expect(spy).toHaveBeenCalledWith({ returnTo: '/community' })
    unsubscribe()
  })

  it('replays pending open to late subscribers', () => {
    openHumanVerification({ returnTo: '/chat' })
    const spy = vi.fn()
    const unsubscribe = subscribeHumanVerificationOpen(spy)
    expect(spy).toHaveBeenCalledWith({ returnTo: '/chat' })
    unsubscribe()
  })

  it('consumes ?human=verify hrefs and returns a cleaned path', () => {
    const spy = vi.fn()
    const unsubscribe = subscribeHumanVerificationOpen(spy)
    const result = consumeHumanVerificationHref('/?human=verify&returnTo=%2Fchat')
    expect(result).toEqual({ cleanedHref: '/', returnTo: '/chat' })
    expect(spy).toHaveBeenCalled()
    unsubscribe()
  })

  it('ignores unrelated hrefs', () => {
    expect(consumeHumanVerificationHref('/community')).toBeNull()
    expect(consumeHumanVerificationHref('/?foo=bar')).toBeNull()
  })
})
