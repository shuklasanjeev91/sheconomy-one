import { describe, expect, it } from 'vitest'
import type { Participant } from 'livekit-client'

import {
  meetingGalleryLayout,
  paginateMeetingGallery,
} from '~/co-work/lib/meeting-gallery-layout'
import { participantDisplayName } from '~/co-work/lib/participant-avatar'

describe('Zoom-style meeting gallery', () => {
  it('uses a balanced 2x2 gallery for three cameras on portrait devices', () => {
    expect(meetingGalleryLayout(3, { width: 366, height: 560 })).toEqual({
      columns: 2,
      rows: 2,
    })
    expect(meetingGalleryLayout(3, { width: 984, height: 520 })).toEqual({
      columns: 3,
      rows: 1,
    })
  })

  it('packs phone landscape across width instead of rotating portrait stacks', () => {
    expect(meetingGalleryLayout(3, { width: 640, height: 280, preferWide: true })).toEqual({
      columns: 3,
      rows: 1,
    })
    expect(meetingGalleryLayout(2, { width: 640, height: 280 })).toEqual({
      columns: 2,
      rows: 1,
    })
    expect(meetingGalleryLayout(4, { width: 700, height: 300, preferWide: true })).toEqual({
      columns: 4,
      rows: 1,
    })
  })

  it('uses Zoom-style grids for 2 / 4 / 6 / 9 participants', () => {
    expect(meetingGalleryLayout(2, { width: 900, height: 600 })).toEqual({ columns: 2, rows: 1 })
    expect(meetingGalleryLayout(4, { width: 700, height: 700 })).toEqual({ columns: 2, rows: 2 })
    expect(meetingGalleryLayout(6, { width: 800, height: 700 })).toEqual({ columns: 3, rows: 2 })
    expect(meetingGalleryLayout(9, { width: 900, height: 700 })).toEqual({ columns: 3, rows: 3 })
  })

  it('keeps four participants in a 2x2 tablet gallery', () => {
    expect(meetingGalleryLayout(4, { width: 980, height: 620 })).toEqual({
      columns: 2,
      rows: 2,
    })
  })

  it('does not expose internal user ids in participant labels', () => {
    expect(
      participantDisplayName({ name: 'user_00bc8abb', identity: 'user_00bc8abb' } as Participant),
    ).toBe('Guest')
    expect(participantDisplayName({ name: 'Ritu Singh', identity: 'user_123' } as Participant)).toBe(
      'Ritu Singh',
    )
  })

  it('paginates large galleries and clamps stale pages', () => {
    const participants = Array.from({ length: 14 }, (_, index) => index)
    expect(paginateMeetingGallery(participants, 1, 6)).toEqual({
      items: [6, 7, 8, 9, 10, 11],
      page: 1,
      pageCount: 3,
    })
    expect(paginateMeetingGallery(participants.slice(0, 2), 5, 6).page).toBe(0)
  })
})
