import { describe, expect, it } from 'vitest'

import {
  meetingStageContentBox,
  resolveMeetingChromeLayout,
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

  it('uses a side filmstrip and compact chrome in phone landscape', () => {
    const chrome = resolveMeetingChromeLayout({
      width: 844,
      height: 390,
      safeTop: 0,
      safeBottom: 21,
      safeLeft: 47,
      safeRight: 47,
    })
    expect(chrome.policy).toBe('landscape-phone')
    expect(chrome.filmstripBeside).toBe(true)
    expect(chrome.compactControls).toBe(true)
    expect(chrome.panelPresentation).toBe('bottom-sheet')
    expect(chrome.panelFullWidth).toBe(true)
    expect(chrome.galleryPreferWide).toBe(true)
    expect(chrome.stagePaddingLeft).toBeGreaterThanOrEqual(47)
    expect(chrome.stagePaddingRight).toBeGreaterThanOrEqual(47)
    expect(chrome.controlsClearance).toBeLessThan(100)
    expect(chrome.headerClearance).toBeLessThan(80)
  })

  it('keeps a bottom filmstrip in phone portrait', () => {
    const chrome = resolveMeetingChromeLayout({
      width: 390,
      height: 844,
      safeTop: 47,
      safeBottom: 34,
      safeLeft: 0,
      safeRight: 0,
    })
    expect(chrome.policy).toBe('portrait-phone')
    expect(chrome.filmstripBeside).toBe(false)
    expect(chrome.panelFullWidth).toBe(true)
    expect(chrome.stagePaddingTop).toBeGreaterThan(chrome.headerClearance)
  })

  it('reserves stage width for a side filmstrip without covering the main tile', () => {
    const chrome = resolveMeetingChromeLayout({
      width: 844,
      height: 390,
      safeLeft: 47,
      safeRight: 47,
    })
    const withStrip = meetingStageContentBox({
      viewportWidth: 844,
      viewportHeight: 390,
      chrome,
      filmstripExpanded: true,
    })
    const withoutStrip = meetingStageContentBox({
      viewportWidth: 844,
      viewportHeight: 390,
      chrome,
      filmstripExpanded: false,
    })
    expect(withStrip.width).toBeLessThan(withoutStrip.width)
    expect(withStrip.height).toBe(withoutStrip.height)
    expect(withStrip.width + chrome.filmstripWidth).toBeLessThanOrEqual(withoutStrip.width + chrome.filmstripWidth + 10)

    const desk = resolveMeetingChromeLayout({ width: 1280, height: 800 })
    const withPanel = meetingStageContentBox({
      viewportWidth: 1280,
      viewportHeight: 800,
      chrome: desk,
      filmstripExpanded: false,
      stageTrailingInset: 400,
    })
    const withoutPanel = meetingStageContentBox({
      viewportWidth: 1280,
      viewportHeight: 800,
      chrome: desk,
      filmstripExpanded: false,
      stageTrailingInset: 0,
    })
    expect(withPanel.width).toBe(withoutPanel.width - 400)
  })
})
