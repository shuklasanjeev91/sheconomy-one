import { describe, expect, it } from 'vitest'

import {
  buildGenderVerificationHandoffUrl,
  shouldUsePhoneHandoff,
} from '~/lib/gender-verification/handoff'

describe('shouldUsePhoneHandoff', () => {
  it('keeps the camera on the native app', () => {
    expect(shouldUsePhoneHandoff({ isNative: true, isMobile: true, hasWebcam: true })).toBe(false)
    expect(shouldUsePhoneHandoff({ isNative: true, isMobile: false, hasWebcam: false })).toBe(false)
  })

  it('shows a QR code on a computer, even when it has a webcam', () => {
    expect(shouldUsePhoneHandoff({ isNative: false, isMobile: false, hasWebcam: true })).toBe(true)
  })

  it('shows a QR code on any web device that has no camera', () => {
    expect(shouldUsePhoneHandoff({ isNative: false, isMobile: true, hasWebcam: false })).toBe(true)
  })

  it('uses the camera on a phone that has one', () => {
    expect(shouldUsePhoneHandoff({ isNative: false, isMobile: true, hasWebcam: true })).toBe(false)
  })
})

describe('buildGenderVerificationHandoffUrl', () => {
  it('points the phone at the handoff route with the token', () => {
    const url = buildGenderVerificationHandoffUrl('abc 123')
    expect(url).toContain('/auth/verify-handoff?t=')
    expect(url).toContain(encodeURIComponent('abc 123'))
  })
})
