import { describe, expect, it } from 'vitest'

import {
  closeInstantMeetingSession,
  instantMeetingCodesMatch,
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

  it('treats dashed and plain meeting codes as the same meeting', () => {
    closeInstantMeetingSession()
    openInstantMeetingSession({
      code: 'ABCDEFGHI',
      meeting: { ...meeting, meeting_code: 'ABC-DEF-GHI' },
      autoJoin: true,
    })
    openInstantMeetingSession({
      code: 'ABC-DEF-GHI',
      meeting: { ...meeting, meeting_code: 'ABC-DEF-GHI' },
      autoJoin: true,
      enteredRoom: true,
      displayName: 'Ada',
    })
    const session = peekInstantMeetingSession()
    expect(session?.enteredRoom).toBe(true)
    expect(session?.displayName).toBe('Ada')
    expect(instantMeetingCodesMatch(session!.code, 'ABC-DEF-GHI')).toBe(true)
    expect(instantMeetingCodesMatch('ABC DEF GHI', 'abc-def-ghi')).toBe(true)
    closeInstantMeetingSession()
  })

  it('expands on bubble Maximize even when enteredRoom is already true', async () => {
    closeInstantMeetingSession()
    const {
      clearGlobalSession,
      maximizeGlobalSession,
      minimizeGlobalSession,
      peekGlobalSession,
      registerGlobalSession,
    } = await import('~/lib/session/global-session')

    clearGlobalSession()
    openInstantMeetingSession({ code: 'ABC123XYZ', meeting, autoJoin: true })
    markInstantMeetingEnteredRoom({ displayName: 'Sanjeev', meeting })
    registerGlobalSession({
      kind: 'meeting',
      code: 'ABC123XYZ',
      title: 'Standup',
      maximizeHref: '/co-work/meeting/ABC123XYZ/live',
      presentation: 'minimized',
    })
    minimizeGlobalSession()
    expect(peekGlobalSession()?.presentation).toBe('minimized')

    openInstantMeetingSession({
      code: 'ABC123XYZ',
      meeting,
      autoJoin: true,
      enteredRoom: true,
      expand: true,
    })
    expect(peekGlobalSession()?.presentation).toBe('fullscreen')
    maximizeGlobalSession()
    expect(peekGlobalSession()?.presentation).toBe('fullscreen')
    closeInstantMeetingSession()
    clearGlobalSession()
  })
})
