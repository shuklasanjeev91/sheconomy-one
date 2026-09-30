import { describe, expect, it } from 'vitest'

import {
  MEETING_MEDIA_AUTO_RETRY_LIMIT,
  MEETING_MEDIA_CREDENTIAL_MAX_ATTEMPTS,
  meetingMediaCredentialRetryDelayMs,
  shouldSilentRemountMedia,
} from '~/co-work/lib/meeting-media-reconnect'

describe('meeting media reconnect', () => {
  it('allows several silent remounts before escalating', () => {
    expect(shouldSilentRemountMedia(0)).toBe(true)
    expect(shouldSilentRemountMedia(1)).toBe(true)
    expect(shouldSilentRemountMedia(2)).toBe(true)
    expect(shouldSilentRemountMedia(MEETING_MEDIA_AUTO_RETRY_LIMIT)).toBe(false)
  })

  it('backs off media token fetches', () => {
    expect(MEETING_MEDIA_CREDENTIAL_MAX_ATTEMPTS).toBeGreaterThanOrEqual(3)
    expect(meetingMediaCredentialRetryDelayMs(0)).toBe(400)
    expect(meetingMediaCredentialRetryDelayMs(1)).toBe(800)
    expect(meetingMediaCredentialRetryDelayMs(10)).toBe(4_000)
  })
})
