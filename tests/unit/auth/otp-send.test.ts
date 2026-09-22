import { afterEach, describe, expect, it, vi } from 'vitest'

import { sha256Hex } from '~/lib/crypto/sha256'
import { AUTH_OTP_TIMEOUT_MESSAGE, requestGoTrueOtp } from '~/lib/supabase/gotrue-otp'
import { mapAuthErrorMessage } from '~/features/auth/validation'

describe('sha256', () => {
  it('matches FIPS 180-4 empty and abc vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
})

describe('requestGoTrueOtp', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('posts email OTP without a PKCE code challenge', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      expect(body.email).toBe('user@example.com')
      expect(body.create_user).toBe(true)
      expect(body.code_challenge).toBeUndefined()
      return { ok: true, json: async () => ({}) } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestGoTrueOtp({
      email: 'user@example.com',
      create_user: true,
    })

    expect(result.error).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/auth/v1/otp')
  })

  it('surfaces rate-limit errors from GoTrue', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({ msg: 'Too many requests', code: 'over_email_send_rate_limit' }),
      })),
    )

    const result = await requestGoTrueOtp({ email: 'user@example.com', create_user: true })
    expect(result.error?.message).toMatch(/too many requests/i)
  })

  it('times out a hung OTP request', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('Aborted')
            error.name = 'AbortError'
            reject(error)
          })
        })
      }),
    )

    const pending = requestGoTrueOtp({ email: 'user@example.com', create_user: true })
    await vi.advanceTimersByTimeAsync(21_000)
    const result = await pending
    expect(result.error?.message).toBe(AUTH_OTP_TIMEOUT_MESSAGE)
  })
})

describe('mapAuthErrorMessage', () => {
  it('maps timeout and abort text to a network retry', () => {
    expect(mapAuthErrorMessage(AUTH_OTP_TIMEOUT_MESSAGE)).toMatchObject({ code: 'network' })
    expect(mapAuthErrorMessage('The operation was aborted due to timeout')).toMatchObject({
      code: 'network',
    })
  })
})
