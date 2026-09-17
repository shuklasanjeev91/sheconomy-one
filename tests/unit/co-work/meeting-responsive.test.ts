import { describe, expect, it } from 'vitest'

import {
  MEETING_BREAKPOINTS,
  meetingPanelPresentation,
  resolveMeetingBreakpoint,
  resolveMeetingResponsiveLayout,
} from '../../../co-work/lib/meeting-responsive'
import { resolveMeetingChromeLayout, resolveMeetingOrientationPolicy } from '../../../co-work/lib/meeting-orientation-layout'

describe('meeting responsive breakpoints', () => {
  it('maps web widths to Mobile → Tablet → Laptop → Desktop → Large Desktop', () => {
    expect(resolveMeetingBreakpoint(390)).toBe('mobile')
    expect(resolveMeetingBreakpoint(MEETING_BREAKPOINTS.tablet)).toBe('tablet')
    expect(resolveMeetingBreakpoint(MEETING_BREAKPOINTS.laptop)).toBe('laptop')
    expect(resolveMeetingBreakpoint(MEETING_BREAKPOINTS.desktop)).toBe('desktop')
    expect(resolveMeetingBreakpoint(MEETING_BREAKPOINTS.largeDesktop)).toBe('large-desktop')
  })

  it('keeps native phones on mobile and tablets on tablet', () => {
    expect(resolveMeetingBreakpoint(1024, { isNative: true, shortestSide: 390 })).toBe('mobile')
    expect(resolveMeetingBreakpoint(1024, { isNative: true, shortestSide: 768 })).toBe('tablet')
  })

  it('uses bottom sheets on mobile and tablet portrait; side panels on laptop+', () => {
    expect(meetingPanelPresentation('mobile')).toBe('bottom-sheet')
    expect(meetingPanelPresentation('tablet', { isLandscape: false })).toBe('bottom-sheet')
    expect(meetingPanelPresentation('tablet', { isLandscape: true })).toBe('side')
    expect(meetingPanelPresentation('laptop')).toBe('side')
    expect(meetingPanelPresentation('desktop')).toBe('side')
    expect(meetingPanelPresentation('large-desktop')).toBe('side')
  })

  it('describes mobile vs desktop meeting chrome recipes', () => {
    const mobile = resolveMeetingResponsiveLayout({ width: 390, height: 844 })
    expect(mobile.toolbarPlacement).toBe('bottom')
    expect(mobile.filmstripPlacement).toBe('bottom')
    expect(mobile.stageMode).toBe('fullscreen')
    expect(mobile.panelPresentation).toBe('bottom-sheet')
    expect(mobile.compactControls).toBe(true)

    const desktop = resolveMeetingResponsiveLayout({ width: 1440, height: 900 })
    expect(desktop.breakpoint).toBe('large-desktop')
    expect(desktop.toolbarPlacement).toBe('bottom')
    expect(desktop.filmstripPlacement).toBe('side')
    expect(desktop.panelPresentation).toBe('side')
    expect(desktop.galleryPreferWide).toBe(true)
  })

  it('wires chrome layout policies to the responsive ladder', () => {
    expect(resolveMeetingOrientationPolicy({ width: 390, height: 844 })).toBe('portrait-phone')
    expect(resolveMeetingOrientationPolicy({ width: 844, height: 390 })).toBe('landscape-phone')
    expect(resolveMeetingOrientationPolicy({ width: 800, height: 1024 })).toBe('tablet')
    expect(resolveMeetingOrientationPolicy({ width: 960, height: 700 })).toBe('laptop')
    expect(resolveMeetingOrientationPolicy({ width: 1200, height: 800 })).toBe('desktop')
    expect(resolveMeetingOrientationPolicy({ width: 1600, height: 900 })).toBe('large-desktop')

    const phone = resolveMeetingChromeLayout({ width: 390, height: 844 })
    expect(phone.panelPresentation).toBe('bottom-sheet')
    expect(phone.compactControls).toBe(true)
    expect(phone.filmstripBeside).toBe(false)

    const desk = resolveMeetingChromeLayout({ width: 1440, height: 900 })
    expect(desk.panelPresentation).toBe('side')
    expect(desk.filmstripBeside).toBe(true)
    expect(desk.compactControls).toBe(false)
    expect(desk.pageSize).toBe(16)
  })
})
