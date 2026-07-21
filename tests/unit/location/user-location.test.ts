import { describe, expect, it } from 'vitest'

import {
  EMPTY_USER_LOCATION,
  buildLocationLabel,
  isStoredGeoFresh,
  mergeUserGeo,
  needsReverseGeocode,
  normalizeCountryCode,
  snapshotFromStored,
  USER_LOCATION_FRESHNESS_MS,
} from '~/lib/location/user-location-utils'

describe('user location utils', () => {
  it('builds a readable location label', () => {
    expect(buildLocationLabel({ city: 'Mumbai', state: 'MH', country: 'IN' })).toBe(
      'Mumbai, MH, IN',
    )
    expect(buildLocationLabel({ postal_code: '400001' })).toBe('400001')
    expect(buildLocationLabel({})).toBeNull()
  })

  it('detects fresh stored geo within the TTL', () => {
    const now = Date.parse('2026-07-18T10:00:00.000Z')
    expect(
      isStoredGeoFresh(
        {
          latitude: 19.07,
          longitude: 72.87,
          capturedAt: new Date(now - 10 * 60 * 1000).toISOString(),
        },
        now,
      ),
    ).toBe(true)

    expect(
      isStoredGeoFresh(
        {
          latitude: 19.07,
          longitude: 72.87,
          capturedAt: new Date(now - USER_LOCATION_FRESHNESS_MS - 1000).toISOString(),
        },
        now,
      ),
    ).toBe(false)

    expect(
      isStoredGeoFresh({
        latitude: null,
        longitude: null,
        capturedAt: new Date().toISOString(),
      }),
    ).toBe(false)
  })

  it('needs reverse geocode when city or country is missing', () => {
    expect(needsReverseGeocode({ latitude: 1, longitude: 2 })).toBe(true)
    expect(needsReverseGeocode({ latitude: 1, longitude: 2, city: 'X', country: 'IN' })).toBe(
      false,
    )
    expect(needsReverseGeocode({ latitude: null, longitude: null })).toBe(false)
  })

  it('merges snapshots without dropping existing fields', () => {
    const base = snapshotFromStored({
      latitude: 19,
      longitude: 72,
      city: 'Mumbai',
      country: 'IN',
      capturedAt: '2026-07-18T09:00:00.000Z',
    })
    const merged = mergeUserGeo(base, { postal_code: '400001', source: 'gps' })
    expect(merged.city).toBe('Mumbai')
    expect(merged.postal_code).toBe('400001')
    expect(merged.source).toBe('gps')
    expect(merged.label).toContain('Mumbai')
  })

  it('normalizes ISO country codes', () => {
    expect(normalizeCountryCode('in')).toBe('IN')
    expect(normalizeCountryCode('India')).toBe('India')
    expect(normalizeCountryCode(null)).toBeNull()
  })

  it('starts from an empty snapshot when storage is empty', () => {
    expect(snapshotFromStored({}).status).toBe('idle')
    expect(EMPTY_USER_LOCATION.source).toBe('none')
  })
})

describe('in-flight locate dedupe', () => {
  it('reuses a single in-flight promise until settled', async () => {
    let starts = 0
    let inflight: Promise<number> | null = null

    async function locateOnce(force = false) {
      if (!force && inflight) return inflight
      inflight = (async () => {
        starts += 1
        await new Promise((resolve) => setTimeout(resolve, 20))
        return starts
      })()
      try {
        return await inflight
      } finally {
        inflight = null
      }
    }

    const [a, b] = await Promise.all([locateOnce(), locateOnce()])
    expect(a).toBe(1)
    expect(b).toBe(1)
    expect(starts).toBe(1)

    const c = await locateOnce(true)
    expect(c).toBe(2)
  })
})
