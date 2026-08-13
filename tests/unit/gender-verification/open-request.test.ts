import { describe, expect, it, vi, beforeEach } from 'vitest'

const rememberReturnTo = vi.fn()
const markFlowOpen = vi.fn()

vi.mock('~/lib/gender-verification/return-to-storage', () => ({
  rememberVerificationReturnTo: (...args: unknown[]) => rememberReturnTo(...args),
}))

vi.mock('~/lib/gender-verification/verification-flow-storage', () => ({
  markVerificationFlowOpen: (...args: unknown[]) => markFlowOpen(...args),
}))

import {
  clearPendingHumanVerificationOpen,
  consumeHumanVerificationHref,
  openHumanVerification,
  peekPendingHumanVerificationOpen,
  subscribeHumanVerificationOpen,
} from '~/lib/gender-verification/open-request'

describe('human verification open request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearPendingHumanVerificationOpen()
  })

  it('notifies subscribers when openHumanVerification is called', () => {
    const spy = vi.fn()
    const unsubscribe = subscribeHumanVerificationOpen(spy)
    openHumanVerification({ returnTo: '/community' })
    // The host needs returnTo so an already-verified member lands on the tab she
    // pressed instead of the request being dropped.
    expect(spy).toHaveBeenCalledWith({ returnTo: '/community' })
    unsubscribe()
  })

  it('replays pending open to late subscribers', () => {
    openHumanVerification({ returnTo: '/chat' })
    expect(peekPendingHumanVerificationOpen()?.returnTo).toBe('/chat')

    const spy = vi.fn()
    const unsubscribe = subscribeHumanVerificationOpen(spy)
    expect(spy).toHaveBeenCalledWith({ returnTo: '/chat' })
    unsubscribe()
  })

  it('does not persist the flow-open flag before the modal is shown', () => {
    openHumanVerification({ returnTo: '/community' })

    // The host marks the flow open once it actually opens the modal; a request it
    // resolves another way must not leave a flag that reopens it next launch.
    expect(markFlowOpen).not.toHaveBeenCalled()
    expect(rememberReturnTo).toHaveBeenCalledWith('/community')
  })

  it('consumes ?human=verify hrefs and returns a cleaned path', () => {
    const spy = vi.fn()
    const unsubscribe = subscribeHumanVerificationOpen(spy)
    const result = consumeHumanVerificationHref('/?human=verify&returnTo=%2Fchat')
    expect(result).toEqual({ cleanedHref: '/', returnTo: '/chat' })
    expect(spy).toHaveBeenCalled()
    expect(peekPendingHumanVerificationOpen()?.returnTo).toBe('/chat')
    unsubscribe()
  })

  it('ignores unrelated hrefs', () => {
    expect(consumeHumanVerificationHref('/community')).toBeNull()
    expect(consumeHumanVerificationHref('/?foo=bar')).toBeNull()
  })
})
