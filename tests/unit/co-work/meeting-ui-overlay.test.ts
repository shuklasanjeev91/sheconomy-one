import { describe, expect, it } from 'vitest'

import {
  applyMeetingUiLayout,
  meetingCriticalControlsAlwaysReachable,
  resolveMeetingUiPadding,
  shouldAutoHideMeetingControls,
} from '../../../co-work/lib/meeting-ui-overlay'
import { resolveMeetingUiLayout } from '../../../co-work/lib/meeting-orientation-layout'

describe('meeting UI overlay', () => {
  it('auto-hides meeting controls in normal, maximized, or screen-share immersion', () => {
    expect(
      shouldAutoHideMeetingControls({
        uiMode: 'normal',
        viewMode: 'gallery',
        panelOpen: false,
        waitingCount: 0,
      }),
    ).toBe(true)

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

  it('never auto-hides while panels, modals, waiting room, busy exit, or pin are active', () => {
    const base = {
      uiMode: 'maximized' as const,
      viewMode: 'screen-share' as const,
      panelOpen: false,
      waitingCount: 0,
    }
    expect(shouldAutoHideMeetingControls({ ...base, panelOpen: true })).toBe(false)
    expect(shouldAutoHideMeetingControls({ ...base, modalOpen: true })).toBe(false)
    expect(shouldAutoHideMeetingControls({ ...base, waitingCount: 2 })).toBe(false)
    expect(shouldAutoHideMeetingControls({ ...base, busy: true })).toBe(false)
    expect(shouldAutoHideMeetingControls({ ...base, controlsPinned: true })).toBe(false)
  })

  it('expands stage area in maximized mode and further when controls are hidden', () => {
    const layout = resolveMeetingUiLayout({
      width: 1280,
      height: 800,
      isDesktop: true,
      safeTop: 0,
      safeBottom: 0,
    })
    const normal = resolveMeetingUiPadding({
      layout,
      uiMode: 'normal',
      controlsVisible: true,
    })
    const maximized = resolveMeetingUiPadding({
      layout,
      uiMode: 'maximized',
      controlsVisible: true,
    })
    const minimal = resolveMeetingUiPadding({
      layout,
      uiMode: 'maximized',
      controlsVisible: false,
    })

    expect(maximized.stagePaddingTop).toBeLessThan(normal.stagePaddingTop)
    expect(maximized.stagePaddingBottom).toBeLessThan(normal.stagePaddingBottom)
    expect(minimal.stagePaddingTop).toBeLessThan(maximized.stagePaddingTop)
    expect(minimal.stagePaddingBottom).toBeLessThan(maximized.stagePaddingBottom)
    expect(minimal.controlsClearance).toBeGreaterThanOrEqual(48)
    expect(meetingCriticalControlsAlwaysReachable()).toBe(true)

    const applied = applyMeetingUiLayout(layout, minimal)
    expect(applied.stagePaddingBottom).toBe(minimal.stagePaddingBottom)
    expect(applied.panelMaxWidthFraction).toBe(layout.panelMaxWidthFraction)
  })
})
