import { describe, expect, it } from 'vitest'

import {
  closeInstantMeetingSession,
  openInstantMeetingSession,
  peekInstantMeetingSession,
} from '~/co-work/lib/instant-meeting-session'
import type { Meeting } from '~/co-work/lib/types'

const meeting = {
  id: 'm1',
  title: 'Standup',
  meeting_code: 'ABC123XYZ',
  host_id: 'u1',
  status: 'live',
} as Meeting

describe('instant meeting session', () => {
  it('defaults to autoJoin for Zoom-style one-tap entry', () => {
    closeInstantMeetingSession()
    openInstantMeetingSession({ code: 'ABC 123 XYZ', meeting })
    expect(peekInstantMeetingSession()).toEqual({
      code: 'ABC123XYZ',
      meeting,
      autoJoin: true,
    })
    closeInstantMeetingSession()
  })

  it('does not remount the same meeting when re-opened (minimize / maximize)', () => {
    closeInstantMeetingSession()
    openInstantMeetingSession({ code: 'ABC123XYZ', meeting, autoJoin: true })
    const first = peekInstantMeetingSession()
    openInstantMeetingSession({ code: 'ABC123XYZ', meeting, autoJoin: false })
    const second = peekInstantMeetingSession()
    expect(second?.code).toBe(first?.code)
    // autoJoin stays false once cleared so the join screen does not reappear
    expect(second?.autoJoin).toBe(false)
    closeInstantMeetingSession()
  })
})
