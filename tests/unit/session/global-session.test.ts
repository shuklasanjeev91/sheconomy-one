import { describe, expect, it, beforeEach } from 'vitest'

import {
  clearGlobalSession,
  enterGlobalSessionPip,
  exitGlobalSessionPip,
  maximizeGlobalSession,
  minimizeGlobalSession,
  peekGlobalSession,
  registerGlobalSession,
  shouldUseChromelessShell,
  updateGlobalSessionMedia,
} from '~/lib/session/global-session'
import { detectSessionPipCapabilities } from '~/lib/session/picture-in-picture'

describe('global session presentation', () => {
  beforeEach(() => {
    clearGlobalSession()
  })

  it('registers a meeting and transitions fullscreen → minimized → pip → maximized', () => {
    registerGlobalSession({
      kind: 'meeting',
      code: 'ABC123',
      title: 'Standup',
      maximizeHref: '/co-work/meeting/ABC123/live',
      presentation: 'fullscreen',
    })
    expect(peekGlobalSession()?.presentation).toBe('fullscreen')

    minimizeGlobalSession()
    expect(peekGlobalSession()?.presentation).toBe('minimized')

    enterGlobalSessionPip()
    expect(peekGlobalSession()?.presentation).toBe('pip')

    exitGlobalSessionPip()
    expect(peekGlobalSession()?.presentation).toBe('minimized')

    maximizeGlobalSession()
    expect(peekGlobalSession()?.presentation).toBe('fullscreen')
  })

  it('updates media flags without resetting presentation', () => {
    registerGlobalSession({
      kind: 'call',
      code: 'CALL1',
      title: 'Ada',
      maximizeHref: '/chat/call/CALL1',
      presentation: 'minimized',
      media: { audioEnabled: true, videoEnabled: true },
    })
    updateGlobalSessionMedia({ audioEnabled: false })
    expect(peekGlobalSession()?.presentation).toBe('minimized')
    expect(peekGlobalSession()?.media.audioEnabled).toBe(false)
  })

  it('clears only the matching session code', () => {
    registerGlobalSession({
      kind: 'meeting',
      code: 'AAA',
      title: 'A',
      maximizeHref: '/a',
    })
    clearGlobalSession('BBB')
    expect(peekGlobalSession()?.code).toBe('AAA')
    clearGlobalSession('AAA')
    expect(peekGlobalSession()).toBeNull()
  })

  it('matches dashed and plain meeting codes as the same session', () => {
    registerGlobalSession({
      kind: 'meeting',
      code: 'ABC-DEF-GHI',
      title: 'Standup',
      maximizeHref: '/co-work/meeting/ABCDEFGHI/live',
      presentation: 'minimized',
    })
    expect(peekGlobalSession()?.code).toBe('ABCDEFGHI')
    registerGlobalSession({
      kind: 'meeting',
      code: 'ABCDEFGHI',
      title: 'Standup',
      maximizeHref: '/co-work/meeting/ABCDEFGHI/live',
    })
    expect(peekGlobalSession()?.presentation).toBe('minimized')
    clearGlobalSession('abc def ghi')
    expect(peekGlobalSession()).toBeNull()
  })
})

describe('chromeless shell gating', () => {
  it('uses chromeless for fullscreen Co-Work meetings (Zoom-style)', () => {
    expect(
      shouldUseChromelessShell({
        pathname: '/co-work/meeting/ABC/live',
        instantMeetingOpen: false,
        globalPresentation: 'fullscreen',
      }),
    ).toBe(true)
    expect(
      shouldUseChromelessShell({
        pathname: '/co-work',
        instantMeetingOpen: true,
        globalPresentation: 'fullscreen',
      }),
    ).toBe(true)
  })

  it('keeps app chrome when the session is minimized or in PiP', () => {
    expect(
      shouldUseChromelessShell({
        pathname: '/community',
        instantMeetingOpen: true,
        globalPresentation: 'minimized',
      }),
    ).toBe(false)
    // Dedicated /live route stays chromeless even if presentation lagged on pip.
    expect(
      shouldUseChromelessShell({
        pathname: '/co-work/meeting/ABC/live',
        instantMeetingOpen: false,
        globalPresentation: 'pip',
      }),
    ).toBe(true)
    expect(
      shouldUseChromelessShell({
        pathname: '/cowork/meeting/ABC/live',
        instantMeetingOpen: false,
        globalPresentation: 'fullscreen',
      }),
    ).toBe(true)
  })

  it('uses chromeless for fullscreen call routes and ui-kit', () => {
    expect(
      shouldUseChromelessShell({
        pathname: '/chat/call/XYZ',
        instantMeetingOpen: false,
        globalPresentation: 'fullscreen',
      }),
    ).toBe(true)
    expect(
      shouldUseChromelessShell({
        pathname: '/ui-kit',
        instantMeetingOpen: false,
        globalPresentation: null,
      }),
    ).toBe(true)
  })
})

describe('session PiP capabilities', () => {
  it('disables OS PiP overlay on Android (no FGS)', () => {
    const caps = detectSessionPipCapabilities('android')
    expect(caps.supported).toBe(false)
    expect(caps.mode).toBe('none')
    expect(caps.unsupportedMessage).toMatch(/Android/i)
  })

  it('marks iOS as AVKit-capable', () => {
    const caps = detectSessionPipCapabilities('ios')
    expect(caps.supported).toBe(true)
    expect(caps.mode).toBe('native_avkit')
  })
})
