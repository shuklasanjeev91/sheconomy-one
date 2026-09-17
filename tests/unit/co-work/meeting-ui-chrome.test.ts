import { describe, expect, it } from 'vitest'

import {
  applyMeetingUiChromeLayout,
  meetingCriticalControlsAlwaysReachable,
  resolveMeetingUiChromePadding,
  shouldAutoHideMeetingControls,
} from '../../../co-work/lib/meeting-ui-chrome'
import { resolveMeetingChromeLayout } from '../../../co-work/lib/meeting-orientation-layout'

describe('meeting UI chrome', () => {
  it('auto-hides only in maximized or screen-share immersion', () => {
    expect(
      shouldAutoHideMeetingControls({
        uiMode: 'normal',
        viewMode: 'gallery',
        panelOpen: false,
        waitingCount: 0,
      }),
    ).toBe(false)

    expect(
      shouldAutoHideMeetingControls({
        uiMode: 'maximized',
        viewMode: 'gallery',
        panelOpen: false,
        waitingCount: 0,
      }),
    ).toBe(true)

    expect(
      shouldAutoHideMeetingControls({
        uiMode: 'normal',
        viewMode: 'screen-share',
        panelOpen: false,
        waitingCount: 0,
      }),
    ).toBe(true)
  })

  it('never auto-hides while panels, waiting room, busy exit, or pin are active', () => {
    const base = {
      uiMode: 'maximized' as const,
      viewMode: 'screen-share' as const,
      panelOpen: false,
      waitingCount: 0,
    }
    expect(shouldAutoHideMeetingControls({ ...base, panelOpen: true })).toBe(false)
    expect(shouldAutoHideMeetingControls({ ...base, waitingCount: 2 })).toBe(false)
    expect(shouldAutoHideMeetingControls({ ...base, busy: true })).toBe(false)
    expect(shouldAutoHideMeetingControls({ ...base, controlsPinned: true })).toBe(false)
  })

  it('expands stage area in maximized mode and further when controls are hidden', () => {
    const chrome = resolveMeetingChromeLayout({
      width: 1280,
      height: 800,
      isDesktop: true,
      safeTop: 0,
      safeBottom: 0,
    })
    const normal = resolveMeetingUiChromePadding({
      chrome,
      uiMode: 'normal',
      controlsVisible: true,
    })
    const maximized = resolveMeetingUiChromePadding({
      chrome,
      uiMode: 'maximized',
      controlsVisible: true,
    })
    const minimal = resolveMeetingUiChromePadding({
      chrome,
      uiMode: 'maximized',
      controlsVisible: false,
    })

    expect(maximized.stagePaddingTop).toBeLessThan(normal.stagePaddingTop)
    expect(maximized.stagePaddingBottom).toBeLessThan(normal.stagePaddingBottom)
    expect(minimal.stagePaddingTop).toBeLessThan(maximized.stagePaddingTop)
    expect(minimal.stagePaddingBottom).toBeLessThan(maximized.stagePaddingBottom)
    expect(minimal.controlsClearance).toBeGreaterThanOrEqual(48)
    expect(meetingCriticalControlsAlwaysReachable()).toBe(true)

    const applied = applyMeetingUiChromeLayout(chrome, minimal)
    expect(applied.stagePaddingBottom).toBe(minimal.stagePaddingBottom)
    expect(applied.panelMaxWidthFraction).toBe(chrome.panelMaxWidthFraction)
  })
})
