import { describe, expect, it } from 'vitest'

import {
  closeInstantMeetingSession,
  markInstantMeetingEnteredRoom,
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
      enteredRoom: false,
      displayName: null,
    })
    closeInstantMeetingSession()
  })

  it('never downgrades autoJoin / enteredRoom on minimize updates', () => {
    closeInstantMeetingSession()
    openInstantMeetingSession({ code: 'ABC123XYZ', meeting, autoJoin: true })
    markInstantMeetingEnteredRoom({ displayName: 'Sanjeev', meeting })
    const first = peekInstantMeetingSession()
    openInstantMeetingSession({ code: 'ABC123XYZ', meeting, autoJoin: false, enteredRoom: false })
    const second = peekInstantMeetingSession()
    expect(second?.code).toBe(first?.code)
    expect(second?.autoJoin).toBe(true)
    expect(second?.enteredRoom).toBe(true)
    expect(second?.displayName).toBe('Sanjeev')
    closeInstantMeetingSession()
  })
})
