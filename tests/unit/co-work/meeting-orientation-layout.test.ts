import { describe, expect, it } from 'vitest'

import {
  meetingStageContentBox,
  resolveMeetingUiLayout,
  resolveMeetingOrientationPolicy,
} from '~/co-work/lib/meeting-orientation-layout'

describe('meeting orientation layout', () => {
  it('classifies phone portrait vs landscape as dedicated policies', () => {
    expect(
      resolveMeetingOrientationPolicy({ width: 390, height: 844 }),
    ).toBe('portrait-phone')
    expect(
      resolveMeetingOrientationPolicy({ width: 844, height: 390 }),
    ).toBe('landscape-phone')
    expect(
      resolveMeetingOrientationPolicy({ width: 820, height: 1180, isTablet: true }),
    ).toBe('tablet')
    expect(
      resolveMeetingOrientationPolicy({ width: 1280, height: 800, isDesktop: true }),
    ).toBe('desktop')
    expect(
      resolveMeetingOrientationPolicy({ width: 1400, height: 900 }),
    ).toBe('large-desktop')
  })

  it('uses a side filmstrip and compact controls in phone landscape', () => {
    const layout = resolveMeetingUiLayout({
      width: 844,
      height: 390,
      safeTop: 0,
      safeBottom: 21,
      safeLeft: 47,
      safeRight: 47,
    })
    expect(layout.policy).toBe('landscape-phone')
    expect(layout.filmstripBeside).toBe(true)
    expect(layout.compactControls).toBe(true)
    expect(layout.panelPresentation).toBe('bottom-sheet')
    expect(layout.panelFullWidth).toBe(true)
    expect(layout.galleryPreferWide).toBe(true)
    expect(layout.stagePaddingLeft).toBeGreaterThanOrEqual(47)
    expect(layout.stagePaddingRight).toBeGreaterThanOrEqual(47)
    expect(layout.controlsClearance).toBeLessThan(100)
    expect(layout.headerClearance).toBeLessThan(80)
  })

  it('keeps a bottom filmstrip in phone portrait', () => {
    const layout = resolveMeetingUiLayout({
      width: 390,
      height: 844,
      safeTop: 47,
      safeBottom: 34,
      safeLeft: 0,
      safeRight: 0,
    })
    expect(layout.policy).toBe('portrait-phone')
    expect(layout.filmstripBeside).toBe(false)
    expect(layout.panelFullWidth).toBe(true)
    expect(layout.stagePaddingTop).toBeGreaterThan(layout.headerClearance)
  })

  it('reserves stage width for a side filmstrip without covering the main tile', () => {
    const layout = resolveMeetingUiLayout({
      width: 844,
      height: 390,
      safeLeft: 47,
      safeRight: 47,
    })
    const withStrip = meetingStageContentBox({
      viewportWidth: 844,
      viewportHeight: 390,
      layout,
      filmstripExpanded: true,
    })
    const withoutStrip = meetingStageContentBox({
      viewportWidth: 844,
      viewportHeight: 390,
      layout,
      filmstripExpanded: false,
    })
    expect(withStrip.width).toBeLessThan(withoutStrip.width)
    expect(withStrip.height).toBe(withoutStrip.height)
    expect(withStrip.width + layout.filmstripWidth).toBeLessThanOrEqual(withoutStrip.width + layout.filmstripWidth + 10)

    const desk = resolveMeetingUiLayout({ width: 1280, height: 800 })
    const withPanel = meetingStageContentBox({
      viewportWidth: 1280,
      viewportHeight: 800,
      layout: desk,
      filmstripExpanded: false,
      stageTrailingInset: 400,
    })
    const withoutPanel = meetingStageContentBox({
      viewportWidth: 1280,
      viewportHeight: 800,
      layout: desk,
      filmstripExpanded: false,
      stageTrailingInset: 0,
    })
    expect(withPanel.width).toBe(withoutPanel.width - 400)
  })
})
