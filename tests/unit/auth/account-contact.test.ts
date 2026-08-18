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
        authUser: { phone: null } as User,
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

  it('is ready when the phone is confirmed on the auth user', () => {
    const contact = resolveCheckoutContact({ user: verifiedAuthUser, profile: null })
    expect(contact.checkoutReady).toBe(true)
    expect(contact.phone).toBe('+919876543210')
  })

  it('is ready when only the profile phone is verified (auth has no phone)', () => {
    const contact = resolveCheckoutContact({
      user: { phone: null } as User,
      profile: { phone: '+918700297615', phone_verified: true },
    })
    expect(contact.checkoutReady).toBe(true)
    expect(contact.phone).toBe('+918700297615')
  })

  it('is not ready when the profile phone is present but unverified', () => {
    const contact = resolveCheckoutContact({
      user: { phone: null } as User,
      profile: { phone: '+918700297615', phone_verified: false },
    })
    expect(contact.checkoutReady).toBe(false)
    expect(contact.phone).toBeNull()
  })

  it('is not ready with no auth phone and no profile', () => {
    const contact = resolveCheckoutContact({ user: { phone: null } as User, profile: null })
    expect(contact.checkoutReady).toBe(false)
  })

  it('prefers the confirmed auth phone over a verified profile phone', () => {
    const contact = resolveCheckoutContact({
      user: verifiedAuthUser,
      profile: { phone: '+918700297615', phone_verified: true },
    })
    expect(contact.phone).toBe('+919876543210')
  })
})
