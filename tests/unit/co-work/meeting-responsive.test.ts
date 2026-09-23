import { describe, expect, it } from 'vitest'

import {
  MEETING_BREAKPOINTS,
  meetingPanelPresentation,
  meetingViewportIsLandscape,
  resolveMeetingBreakpoint,
  resolveMeetingResponsiveLayout,
} from '../../../co-work/lib/meeting-responsive'
import { resolveMeetingUiLayout, resolveMeetingOrientationPolicy } from '../../../co-work/lib/meeting-orientation-layout'

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

  it('does not treat a portrait keyboard-shrunk viewport as landscape', () => {
    expect(meetingViewportIsLandscape(390, 844)).toBe(false)
    expect(meetingViewportIsLandscape(390, 360)).toBe(false)
    expect(meetingViewportIsLandscape(768, 700)).toBe(false)
    expect(meetingViewportIsLandscape(844, 390)).toBe(true)
    expect(meetingViewportIsLandscape(1024, 768)).toBe(true)

    expect(resolveMeetingResponsiveLayout({ width: 390, height: 360 }).panelPresentation).toBe(
      'bottom-sheet',
    )
    expect(
      resolveMeetingResponsiveLayout({
        width: 390,
        height: 700,
        isNative: true,
      }).panelPresentation,
    ).toBe('bottom-sheet')
  })

  it('uses Zoom desktop/tablet UI from tablet up (side panels + roomy dock)', () => {
    const tabletPortrait = resolveMeetingResponsiveLayout({ width: 800, height: 1024 })
    expect(tabletPortrait.breakpoint).toBe('tablet')
    expect(tabletPortrait.panelPresentation).toBe('side')
    expect(tabletPortrait.compactControls).toBe(false)

    const tabletLandscape = resolveMeetingResponsiveLayout({ width: 1024, height: 768 })
    // Web width 1024 is desktop breakpoint — Zoom desktop.
    expect(tabletLandscape.breakpoint).toBe('desktop')
    expect(tabletLandscape.panelPresentation).toBe('side')

    const webTabletBand = resolveMeetingResponsiveLayout({ width: 780, height: 600 })
    expect(webTabletBand.breakpoint).toBe('tablet')
    expect(webTabletBand.panelPresentation).toBe('side')
    expect(webTabletBand.compactControls).toBe(false)

    const laptop = resolveMeetingResponsiveLayout({ width: 900, height: 700 })
    expect(laptop.breakpoint).toBe('laptop')
    expect(laptop.panelPresentation).toBe('side')
    expect(laptop.compactControls).toBe(false)

    expect(meetingPanelPresentation('tablet', { isLandscape: true })).toBe('side')
    expect(meetingPanelPresentation('laptop')).toBe('side')
    expect(meetingPanelPresentation('mobile')).toBe('bottom-sheet')

    const nativeTablet = resolveMeetingResponsiveLayout({
      width: 1024,
      height: 768,
      isNative: true,
    })
    expect(nativeTablet.breakpoint).toBe('tablet')
    expect(nativeTablet.panelPresentation).toBe('side')
    expect(nativeTablet.compactControls).toBe(false)

    const tabletLayout = resolveMeetingUiLayout({ width: 800, height: 1024 })
    expect(tabletLayout.panelPresentation).toBe('side')
    expect(tabletLayout.compactControls).toBe(false)
    expect(tabletLayout.panelFullWidth).toBe(false)
  })


  it('describes mobile vs desktop meeting UI recipes', () => {
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

  it('wires layout policies to the responsive ladder', () => {
    expect(resolveMeetingOrientationPolicy({ width: 390, height: 844 })).toBe('portrait-phone')
    expect(resolveMeetingOrientationPolicy({ width: 844, height: 390 })).toBe('landscape-phone')
    expect(resolveMeetingOrientationPolicy({ width: 800, height: 1024 })).toBe('tablet')
    expect(resolveMeetingOrientationPolicy({ width: 960, height: 700 })).toBe('laptop')
    expect(resolveMeetingOrientationPolicy({ width: 1200, height: 800 })).toBe('desktop')
    expect(resolveMeetingOrientationPolicy({ width: 1600, height: 900 })).toBe('large-desktop')

    const phone = resolveMeetingUiLayout({ width: 390, height: 844 })
    expect(phone.panelPresentation).toBe('bottom-sheet')
    expect(phone.compactControls).toBe(true)
    expect(phone.filmstripBeside).toBe(false)

    const tablet = resolveMeetingUiLayout({ width: 800, height: 1024 })
    expect(tablet.panelPresentation).toBe('side')
    expect(tablet.compactControls).toBe(false)
    expect(tablet.filmstripBeside).toBe(false)

    const desk = resolveMeetingUiLayout({ width: 1440, height: 900 })
    expect(desk.panelPresentation).toBe('side')
    expect(desk.filmstripBeside).toBe(true)
    expect(desk.compactControls).toBe(false)
    expect(desk.pageSize).toBe(25)

    const phoneLayout = resolveMeetingResponsiveLayout({ width: 390, height: 844 })
    expect(phoneLayout.pageSize).toBe(12)
    const midPhone = resolveMeetingResponsiveLayout({ width: 390, height: 700 })
    expect(midPhone.pageSize).toBe(9)
    const shortPhone = resolveMeetingResponsiveLayout({ width: 390, height: 600 })
    expect(shortPhone.pageSize).toBe(6)
  })
})
