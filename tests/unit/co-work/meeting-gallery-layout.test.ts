import { describe, expect, it } from 'vitest'
import type { Participant } from 'livekit-client'

import { meetingGalleryLayout } from '~/co-work/lib/meeting-gallery-layout'
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
})
