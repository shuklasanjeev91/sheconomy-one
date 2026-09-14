import { describe, expect, it } from 'vitest'

import { buildMeetingSharePayload } from '~/co-work/lib/meeting-share'
import type { Meeting } from '~/co-work/lib/types'
import { buildShareTargetUrl } from '~/lib/share/actions'

const meeting: Meeting = {
  id: 'meeting-1',
  title: 'Founder planning session',
  description: 'Review the launch plan and next steps.',
  meeting_code: 'VACLLMWGO',
  host_id: 'host-1',
  status: 'scheduled',
  scheduled_at: '2026-09-14T10:30:00.000Z',
  started_at: null,
  ended_at: null,
  time_zone: 'Asia/Kolkata',
  max_participants: 20,
  room_id: 'room-1',
  security_settings: null,
  meeting_options: null,
  created_at: '2026-09-12T05:00:00.000Z',
  host: {
    full_name: 'Sanjeev Shukla',
    username: 'sanjeev',
    avatar_url: null,
  },
}

describe('meeting sharing', () => {
  it('includes Zoom-style details and appends the meeting URL once', () => {
    const payload = buildMeetingSharePayload(meeting)
    const whatsappMessage = decodeURIComponent(
      buildShareTargetUrl('whatsapp', payload).split('?text=')[1] ?? '',
    )

    expect(whatsappMessage).toContain('Founder planning session')
    expect(whatsappMessage).toContain('Review the launch plan and next steps.')
    expect(whatsappMessage).toContain('Date:')
    expect(whatsappMessage).toContain('Time:')
    expect(whatsappMessage).toContain('Host: Sanjeev Shukla')
    expect(whatsappMessage).toContain('Meeting ID: VAC LLM WGO')
    expect(whatsappMessage.match(/https:\/\/sheconomy\.in\/co-work\/meeting\/VACLLMWGO/g)).toHaveLength(1)
  })
})
