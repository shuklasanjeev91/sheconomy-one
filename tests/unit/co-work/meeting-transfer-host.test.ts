import { describe, expect, it } from 'vitest'

import { transferHostCandidates } from '~/co-work/lib/meeting-transfer-host'
import type { MeetingParticipant } from '~/co-work/lib/types'

function row(
  partial: Partial<MeetingParticipant> & Pick<MeetingParticipant, 'id' | 'user_id' | 'status'>,
): MeetingParticipant {
  return {
    meeting_id: 'm1',
    display_name: partial.display_name ?? 'Guest',
    is_host: false,
    is_muted: false,
    is_video_off: false,
    role: 'participant',
    ...partial,
  } as MeetingParticipant
}

describe('transferHostCandidates', () => {
  it('lists admitted non-host participants for Zoom-style transfer', () => {
    const host = row({
      id: '1',
      user_id: 'host',
      status: 'admitted',
      is_host: true,
      role: 'host',
      display_name: 'Host',
    })
    const coHost = row({
      id: '2',
      user_id: 'co',
      status: 'admitted',
      role: 'co_host',
      display_name: 'Co',
    })
    const guest = row({
      id: '3',
      user_id: 'guest',
      status: 'admitted',
      display_name: 'Guest',
    })
    const waiting = row({
      id: '4',
      user_id: 'wait',
      status: 'waiting',
      display_name: 'Waiting',
    })

    const candidates = transferHostCandidates([host, coHost, guest, waiting], 'host')
    expect(candidates.map((p) => p.user_id)).toEqual(['co', 'guest'])
  })
})
