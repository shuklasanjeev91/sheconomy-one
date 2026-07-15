import { describe, expect, it } from 'vitest'

import {
  isCompleteOtp,
  mapAuthErrorMessage,
  normalizeOtpDigits,
  validateEmailAddress,
  validateFullName,
} from '~/features/auth/validation'

describe('auth validation', () => {
  it('validates email and name', () => {
    expect(validateEmailAddress('a@b.com')).toBeNull()
    expect(validateEmailAddress('bad')).toBeTruthy()
    expect(validateFullName('Ada')).toBeNull()
    expect(validateFullName('')).toBeTruthy()
  })

  it('normalizes otp paste input', () => {
    expect(normalizeOtpDigits('12 34-56')).toBe('123456')
    expect(normalizeOtpDigits('1234567890', 6)).toBe('123456')
    expect(isCompleteOtp('123456')).toBe(true)
    expect(isCompleteOtp('12345')).toBe(false)
  })

  it('maps auth errors safely without echoing secrets', () => {
    expect(mapAuthErrorMessage('Token has expired')).toMatchObject({ code: 'expired' })
    expect(mapAuthErrorMessage('Invalid OTP')).toMatchObject({ code: 'invalid' })
    expect(mapAuthErrorMessage('Too many requests')).toMatchObject({ code: 'rate_limited' })
    expect(mapAuthErrorMessage('Network request failed')).toMatchObject({ code: 'network' })
  })
})
