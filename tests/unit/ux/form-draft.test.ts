import { describe, expect, it } from 'vitest'

import { isDraftFresh } from '~/lib/drafts/draft-freshness'

describe('form draft expiry', () => {
  it('treats recent drafts as fresh', () => {
    const now = Date.parse('2026-07-17T12:00:00.000Z')
    expect(isDraftFresh('2026-07-17T11:00:00.000Z', 1000 * 60 * 60 * 24, now)).toBe(true)
  })

  it('expires stale drafts', () => {
    const now = Date.parse('2026-07-17T12:00:00.000Z')
    expect(isDraftFresh('2026-07-01T12:00:00.000Z', 1000 * 60 * 60 * 24, now)).toBe(false)
  })

  it('rejects invalid timestamps', () => {
    expect(isDraftFresh('not-a-date')).toBe(false)
  })
})
