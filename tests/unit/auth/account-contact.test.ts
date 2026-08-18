import type { User } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import {
  formatCustomerContactPhone,
  resolveCheckoutContact,
  resolveCustomerPhone,
} from '~/features/auth/services/account-contact'

describe('resolveCustomerPhone', () => {
  it('prefers auth user phone over profile phone', () => {
    const authUser = {
      phone: '+919876543210',
      phone_confirmed_at: '2026-01-01T00:00:00.000Z',
    } as User

    expect(
      resolveCustomerPhone({
        authUser,
        profilePhone: '+441234567890',
      }),
    ).toBe('+919876543210')
  })

  it('falls back to profile phone when auth user has none', () => {
    expect(
      resolveCustomerPhone({
        authUser: { phone: null } as unknown as User,
        profilePhone: '+919876543210',
      }),
    ).toBe('+919876543210')
  })

  it('formats customer contact for invoices', () => {
    expect(
      formatCustomerContactPhone({
        profilePhone: '+919876543210',
      }),
    ).toContain('+91')
  })
})

describe('resolveCheckoutContact', () => {
  const verifiedAuthUser = {
    phone: '+919876543210',
    phone_confirmed_at: '2026-01-01T00:00:00.000Z',
  } as User

  type CheckoutProfile = NonNullable<Parameters<typeof resolveCheckoutContact>[0]['profile']>

  const profileOf = (overrides: Partial<CheckoutProfile>): CheckoutProfile => ({
    phone: null,
    phone_verified: false,
    checkout_phone: null,
    checkout_phone_verified_at: null,
    ...overrides,
  })

  it('is ready when the phone is confirmed on the auth user', () => {
    const contact = resolveCheckoutContact({ user: verifiedAuthUser, profile: null })
    expect(contact.checkoutReady).toBe(true)
    expect(contact.phone).toBe('+919876543210')
  })

  it('is ready once checkout OTP stamped checkout_phone_verified_at', () => {
    const contact = resolveCheckoutContact({
      user: { phone: null } as unknown as User,
      profile: profileOf({
        checkout_phone: '+918700297615',
        checkout_phone_verified_at: '2026-08-18T00:00:00.000Z',
      }),
    })
    expect(contact.checkoutReady).toBe(true)
    expect(contact.phone).toBe('+918700297615')
  })

  it('is ready on a number shared with another account, where profiles.phone stays empty', () => {
    // check_unique_profile_contact() blocks the profiles.phone mirror when another
    // profile already holds the number; checkout must still be unblocked.
    const contact = resolveCheckoutContact({
      user: { phone: null } as unknown as User,
      profile: profileOf({
        phone: null,
        phone_verified: false,
        checkout_phone: '+918700297615',
        checkout_phone_verified_at: '2026-08-18T00:00:00.000Z',
      }),
    })
    expect(contact.checkoutReady).toBe(true)
    expect(contact.phone).toBe('+918700297615')
  })

  it('is not ready when checkout_phone was never stamped verified', () => {
    const contact = resolveCheckoutContact({
      user: { phone: null } as unknown as User,
      profile: profileOf({ checkout_phone: '+918700297615' }),
    })
    expect(contact.checkoutReady).toBe(false)
    expect(contact.phone).toBeNull()
  })

  it('is ready on the legacy profiles.phone_verified signal', () => {
    const contact = resolveCheckoutContact({
      user: { phone: null } as unknown as User,
      profile: profileOf({ phone: '+918700297615', phone_verified: true }),
    })
    expect(contact.checkoutReady).toBe(true)
    expect(contact.phone).toBe('+918700297615')
  })

  it('is not ready when the profile phone is present but unverified', () => {
    const contact = resolveCheckoutContact({
      user: { phone: null } as unknown as User,
      profile: profileOf({ phone: '+918700297615' }),
    })
    expect(contact.checkoutReady).toBe(false)
    expect(contact.phone).toBeNull()
  })

  it('is not ready with no auth phone and no profile', () => {
    const contact = resolveCheckoutContact({ user: { phone: null } as unknown as User, profile: null })
    expect(contact.checkoutReady).toBe(false)
  })

  it('prefers the confirmed auth phone over a legacy verified profile phone', () => {
    const contact = resolveCheckoutContact({
      user: verifiedAuthUser,
      profile: profileOf({ phone: '+918700297615', phone_verified: true }),
    })
    expect(contact.phone).toBe('+919876543210')
  })

  it('prefers a freshly verified checkout phone over the confirmed auth phone', () => {
    const contact = resolveCheckoutContact({
      user: verifiedAuthUser,
      profile: profileOf({
        checkout_phone: '+918700297615',
        checkout_phone_verified_at: '2026-08-18T00:00:00.000Z',
      }),
    })
    expect(contact.phone).toBe('+918700297615')
  })
})
