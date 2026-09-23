import { beforeEach, describe, expect, it, vi } from 'vitest'

const invoke = vi.fn()

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    functions: { invoke },
    from: vi.fn(),
  },
}))

vi.mock('~/lib/platform/openUrl', () => ({
  openExternalUrl: vi.fn(async () => true),
}))

vi.mock('~/co-work/lib/meeting-feature-flags', () => ({
  meetingFeatureFlags: { calendarSync: true },
}))

describe('startCalendarOAuth error surfacing', () => {
  beforeEach(() => {
    invoke.mockReset()
  })

  it('replaces generic non-2xx with the edge function error body', async () => {
    const { startCalendarOAuth } = await import('~/lib/calendar/connections')
    invoke.mockResolvedValue({
      data: {
        error: 'GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET are not configured',
        configured: false,
      },
      error: new Error('Edge Function returned a non-2xx status code'),
    })

    await expect(startCalendarOAuth('google')).rejects.toThrow(
      /Google Calendar sync is not configured yet/,
    )
  })

  it('returns authorizationUrl on success', async () => {
    const { startCalendarOAuth } = await import('~/lib/calendar/connections')
    invoke.mockResolvedValue({
      data: { authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1', configured: true },
      error: null,
    })

    await expect(startCalendarOAuth('google')).resolves.toEqual({
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1',
    })
  })
})
