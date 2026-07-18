import { beforeEach, describe, expect, it, vi } from 'vitest'

const fromMock = vi.fn()

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { moveWishlistItem } from '~/commerce/lib/wishlist'
import { mergeHostedAndInvitedMeetings } from '~/co-work/lib/meetings'
import type { Meeting } from '~/co-work/lib/types'
import {
  isClassCatalogBrowsePath,
  mediaTabFromPath,
  shouldShowClassLearnHub,
} from '~/class/lib/media-tab'

function meetingStub(partial: Partial<Meeting> & { id: string }): Meeting {
  return {
    id: partial.id,
    title: partial.title ?? 'Meeting',
    description: null,
    host_id: 'host',
    meeting_code: 'ABC',
    room_id: null,
    status: 'scheduled',
    scheduled_at: partial.scheduled_at ?? '2026-07-20T10:00:00Z',
    started_at: null,
    ended_at: null,
    created_at: '2026-07-01T00:00:00Z',
    time_zone: 'UTC',
    max_participants: 10,
    invitees: [],
    security_settings: {},
    meeting_options: {},
  }
}

describe('moveWishlistItem', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('updates collection_id for the user listing pair', async () => {
    const eqListing = vi.fn().mockResolvedValue({ error: null })
    const eqUser = vi.fn(() => ({ eq: eqListing }))
    const update = vi.fn(() => ({ eq: eqUser }))
    fromMock.mockReturnValue({ update })

    const result = await moveWishlistItem('user-1', 'listing-1', 'col-9')
    expect(result.error).toBeNull()
    expect(fromMock).toHaveBeenCalledWith('wishlists')
    expect(update).toHaveBeenCalledWith({ collection_id: 'col-9' })
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1')
    expect(eqListing).toHaveBeenCalledWith('listing_id', 'listing-1')
  })

  it('allows clearing collection with null', async () => {
    const eqListing = vi.fn().mockResolvedValue({ error: null })
    const eqUser = vi.fn(() => ({ eq: eqListing }))
    const update = vi.fn(() => ({ eq: eqUser }))
    fromMock.mockReturnValue({ update })

    await moveWishlistItem('user-1', 'listing-1', null)
    expect(update).toHaveBeenCalledWith({ collection_id: null })
  })
})

describe('mergeHostedAndInvitedMeetings', () => {
  it('merges invited ids and sorts by scheduled_at', () => {
    const hosted = [meetingStub({ id: 'h1', scheduled_at: '2026-07-22T10:00:00Z' })]
    const invited = [
      meetingStub({ id: 'i1', scheduled_at: '2026-07-21T10:00:00Z' }),
      meetingStub({ id: 'h1', scheduled_at: '2026-07-22T10:00:00Z' }),
    ]
    const merged = mergeHostedAndInvitedMeetings(hosted, invited)
    expect(merged.map((m) => m.id)).toEqual(['i1', 'h1'])
  })
})

describe('class media tab / hub', () => {
  it('mediaTabFromPath maps audio vs video catalog', () => {
    expect(mediaTabFromPath('/class/audio')).toBe('audio')
    expect(mediaTabFromPath('/class/video')).toBe('video')
    expect(mediaTabFromPath('/class')).toBe('video')
  })

  it('learn hub is home path; catalog is video/audio', () => {
    expect(shouldShowClassLearnHub('/class')).toBe(true)
    expect(shouldShowClassLearnHub('/class/video')).toBe(false)
    expect(isClassCatalogBrowsePath('/class/video')).toBe(true)
    expect(isClassCatalogBrowsePath('/class')).toBe(false)
  })
})
