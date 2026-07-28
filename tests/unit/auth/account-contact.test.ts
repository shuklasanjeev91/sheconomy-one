import type { User } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import {
  formatCustomerContactPhone,
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
