import { describe, expect, it } from 'vitest'

/** Mirrors supabase/functions/_shared/payu-child.ts for unit coverage. */
function childFromAccountMetadata(meta: Record<string, unknown>): {
  merchantKey: string
  childMid: string
} | null {
  const childKey =
    typeof meta.child_merchant_key === 'string'
      ? meta.child_merchant_key.trim()
      : typeof meta.merchant_key === 'string' && meta.onboarded_via === 'sheconomy'
        ? String(meta.merchant_key).trim()
        : ''
  if (!childKey) return null
  const childMid =
    typeof meta.child_mid === 'string' && meta.child_mid.trim() ? meta.child_mid.trim() : ''
  if (!childMid) return null
  return { merchantKey: childKey, childMid }
}

function isShepayReady(meta: Record<string, unknown>, status: string): boolean {
  if (status !== 'connected') return false
  return Boolean(childFromAccountMetadata(meta))
}

describe('SHEPay child merchant readiness', () => {
  it('treats key + MID as ready for split/release', () => {
    expect(
      isShepayReady(
        {
          onboarded_via: 'sheconomy',
          child_merchant_key: 'abcKey',
          child_mid: '123456',
        },
        'connected',
      ),
    ).toBe(true)
  })

  it('holds payout when MID is missing', () => {
    expect(
      childFromAccountMetadata({
        onboarded_via: 'sheconomy',
        merchant_key: 'abcKey',
      }),
    ).toBeNull()
    expect(
      isShepayReady(
        {
          onboarded_via: 'sheconomy',
          merchant_key: 'abcKey',
        },
        'connected',
      ),
    ).toBe(false)
  })

  it('holds payout when account is not connected', () => {
    expect(
      isShepayReady(
        {
          child_merchant_key: 'abcKey',
          child_mid: '123456',
        },
        'pending',
      ),
    ).toBe(false)
  })

  it('accepts existing PayU key stored as child_merchant_key', () => {
    expect(
      childFromAccountMetadata({
        child_merchant_key: 'gtKFFx',
        child_mid: '8090123',
      }),
    ).toEqual({ merchantKey: 'gtKFFx', childMid: '8090123' })
  })
})
