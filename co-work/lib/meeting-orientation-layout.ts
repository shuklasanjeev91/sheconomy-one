/**
 * Dedicated meeting orientation + responsive layout strategy.
 *
 * Breakpoints: Mobile → Tablet → Laptop → Desktop → Large Desktop
 * Portrait and landscape phone policies stay separate — never rotate portrait metrics.
 */

import {
  resolveMeetingResponsiveLayout,
  type MeetingBreakpoint,
} from '~/co-work/lib/meeting-responsive'

export type MeetingOrientationPolicy =
  | 'portrait-phone'
  | 'landscape-phone'
  | 'tablet'
  | 'laptop'
  | 'desktop'
  | 'large-desktop'

export type MeetingChromeLayout = {
  policy: MeetingOrientationPolicy
  breakpoint: MeetingBreakpoint
  isLandscape: boolean
  /** Participant strip sits beside the stage (does not cover faces at the bottom). */
  filmstripBeside: boolean
  filmstripWidth: number
  filmstripHeight: number
  pipWidth: number
  pipHeight: number
  headerClearance: number
  controlsClearance: number
  horizontalPad: number
  stagePaddingTop: number
  stagePaddingBottom: number
  stagePaddingLeft: number
  stagePaddingRight: number
  panelTop: number
  panelBottom: number
  panelTrailingInset: number
  /** 0–1 fraction of viewport width for side panels. */
  panelMaxWidthFraction: number
  /** True when Chat/Participants should render as a bottom sheet. */
  panelFullWidth: boolean
  panelPresentation: 'bottom-sheet' | 'side'
  compactControls: boolean
  captionWideLayout: boolean
  captionTopOffset: number
  captionBottomOffset: number
  captionSideInset: number
  galleryPreferWide: boolean
  pageSize: number
}

export type MeetingChromeLayoutInput = {
  width: number
  height: number
  safeTop?: number
  safeBottom?: number
  safeLeft?: number
  safeRight?: number
  isTablet?: boolean
  isDesktop?: boolean
  isNative?: boolean
}

export function resolveMeetingOrientationPolicy(
  input: MeetingChromeLayoutInput,
): MeetingOrientationPolicy {
  const width = Math.max(input.width, 1)
  const height = Math.max(input.height, 1)
  const shortest = Math.min(width, height)

  // Phone-class viewports (including landscape phones ~844×390) stay on phone
  // policies even when the long edge crosses the tablet width breakpoint.
  if (shortest < 500) {
    return width > height ? 'landscape-phone' : 'portrait-phone'
  }

  const responsive = resolveMeetingResponsiveLayout({
    width,
    height,
    isNative: input.isNative,
  })

  switch (responsive.breakpoint) {
    case 'mobile':
      return width > height ? 'landscape-phone' : 'portrait-phone'
    case 'tablet':
      return 'tablet'
    case 'laptop':
      return 'laptop'
    case 'large-desktop':
      return 'large-desktop'
    case 'desktop':
    default:
      return 'desktop'
  }
}

export function resolveMeetingChromeLayout(input: MeetingChromeLayoutInput): MeetingChromeLayout {
  const width = Math.max(input.width, 1)
  const height = Math.max(input.height, 1)
  const safeTop = Math.max(input.safeTop ?? 0, 0)
  const safeBottom = Math.max(input.safeBottom ?? 0, 0)
  const safeLeft = Math.max(input.safeLeft ?? 0, 0)
  const safeRight = Math.max(input.safeRight ?? 0, 0)
  const responsive = resolveMeetingResponsiveLayout({
    width,
    height,
    isNative: input.isNative,
  })
  const policy = resolveMeetingOrientationPolicy(input)
  const isLandscape = width > height
  // Phone landscape still uses sheets so chat/people don't cover the stage.
  const panelPresentation =
    policy === 'portrait-phone' || policy === 'landscape-phone'
      ? 'bottom-sheet'
      : responsive.panelPresentation
  const panelFullWidth = panelPresentation === 'bottom-sheet'

  if (policy === 'large-desktop' || policy === 'desktop' || policy === 'laptop') {
    const filmstripWidth = policy === 'large-desktop' ? 200 : policy === 'desktop' ? 176 : 156
    const horizontalPad = policy === 'laptop' ? 20 : 24
    const controlsClearance = 120
    return {
      policy,
      breakpoint: responsive.breakpoint,
      isLandscape,
      filmstripBeside: true,
      filmstripWidth,
      filmstripHeight: Math.max(height - 200, 180),
      pipWidth: Math.max(filmstripWidth - 20, 140),
      pipHeight: 88,
      headerClearance: 88,
      controlsClearance,
      horizontalPad,
      stagePaddingTop: Math.max(safeTop, 12) + 88,
      stagePaddingBottom: controlsClearance + safeBottom,
      stagePaddingLeft: horizontalPad + safeLeft,
      stagePaddingRight: horizontalPad + safeRight,
      panelTop: Math.max(safeTop, 8) + 84,
      panelBottom: controlsClearance + safeBottom,
      panelTrailingInset: 12 + safeRight,
      panelMaxWidthFraction: responsive.sidePanelWidthFraction,
      panelFullWidth,
      panelPresentation,
      compactControls: false,
      captionWideLayout: true,
      captionTopOffset: 96,
      captionBottomOffset: 136,
      captionSideInset: 16 + safeLeft,
      galleryPreferWide: true,
      pageSize: responsive.pageSize,
    }
  }

  if (policy === 'tablet') {
    const filmstripBeside = responsive.filmstripPlacement === 'side'
    const controlsClearance = isLandscape ? 104 : 120
    return {
      policy,
      breakpoint: responsive.breakpoint,
      isLandscape,
      filmstripBeside,
      filmstripWidth: filmstripBeside ? 148 : width - 40,
      filmstripHeight: filmstripBeside ? Math.max(height - 220, 160) : 92,
      pipWidth: filmstripBeside ? 140 : 132,
      pipHeight: 78,
      headerClearance: isLandscape ? 72 : 88,
      controlsClearance,
      horizontalPad: 20,
      stagePaddingTop: Math.max(safeTop, 10) + (isLandscape ? 72 : 88),
      stagePaddingBottom: controlsClearance + safeBottom,
      stagePaddingLeft: 20 + safeLeft,
      stagePaddingRight: 20 + safeRight,
      panelTop: Math.max(safeTop, 8) + (isLandscape ? 68 : 84),
      panelBottom: controlsClearance + safeBottom,
      panelTrailingInset: 12 + safeRight,
      panelMaxWidthFraction: responsive.sidePanelWidthFraction,
      panelFullWidth,
      panelPresentation,
      compactControls: false,
      captionWideLayout: true,
      captionTopOffset: isLandscape ? 80 : 92,
      captionBottomOffset: controlsClearance + 20,
      captionSideInset: 14 + safeLeft,
      galleryPreferWide: true,
      pageSize: responsive.pageSize,
    }
  }

  if (policy === 'landscape-phone') {
    const filmstripWidth = Math.min(128, Math.max(104, Math.round(width * 0.18)))
    const headerClearance = 56
    const controlsClearance = 78
    return {
      policy,
      breakpoint: responsive.breakpoint,
      isLandscape: true,
      filmstripBeside: true,
      filmstripWidth,
      filmstripHeight: Math.max(height - headerClearance - controlsClearance - safeTop - safeBottom, 120),
      pipWidth: filmstripWidth,
      pipHeight: Math.round(filmstripWidth * 0.56),
      headerClearance,
      controlsClearance,
      horizontalPad: 10,
      stagePaddingTop: Math.max(safeTop, 6) + headerClearance,
      stagePaddingBottom: controlsClearance + Math.max(safeBottom, 4),
      stagePaddingLeft: 10 + safeLeft,
      stagePaddingRight: 10 + safeRight,
      panelTop: Math.max(safeTop, 4) + 52,
      panelBottom: controlsClearance + Math.max(safeBottom, 4),
      panelTrailingInset: 8 + safeRight,
      panelMaxWidthFraction: 1,
      panelFullWidth: true,
      panelPresentation: 'bottom-sheet',
      compactControls: true,
      captionWideLayout: true,
      captionTopOffset: Math.max(safeTop, 4) + 58,
      captionBottomOffset: controlsClearance + Math.max(safeBottom, 4) + 8,
      captionSideInset: 10 + safeLeft,
      galleryPreferWide: true,
      pageSize: responsive.pageSize,
    }
  }

  // portrait-phone — bottom controls + bottom filmstrip + sheet panels.
  return {
    policy,
    breakpoint: responsive.breakpoint,
    isLandscape: false,
    filmstripBeside: false,
    filmstripWidth: Math.max(width - 24, 160),
    filmstripHeight: 84,
    pipWidth: 132,
    pipHeight: 74,
    headerClearance: 88,
    controlsClearance: 116,
    horizontalPad: 12,
    stagePaddingTop: Math.max(safeTop, 12) + 88,
    stagePaddingBottom: 116 + safeBottom,
    stagePaddingLeft: 12 + safeLeft,
    stagePaddingRight: 12 + safeRight,
    panelTop: Math.max(safeTop, 8) + 88,
    panelBottom: 116 + safeBottom,
    panelTrailingInset: 12 + safeRight,
    panelMaxWidthFraction: 1,
    panelFullWidth: true,
    panelPresentation: 'bottom-sheet',
    compactControls: true,
    captionWideLayout: false,
    captionTopOffset: 88,
    captionBottomOffset: 128,
    captionSideInset: 12,
    galleryPreferWide: false,
    pageSize: responsive.pageSize,
  }
}

/** Usable stage box after chrome + optional side filmstrip. */
export function meetingStageContentBox(input: {
  viewportWidth: number
  viewportHeight: number
  chrome: MeetingChromeLayout
  filmstripExpanded: boolean
}): { width: number; height: number } {
  const chrome = input.chrome
  const availableWidth = Math.max(
    input.viewportWidth - chrome.stagePaddingLeft - chrome.stagePaddingRight,
    160,
  )
  const availableHeight = Math.max(
    input.viewportHeight - chrome.stagePaddingTop - chrome.stagePaddingBottom,
    120,
  )
  if (input.filmstripExpanded && chrome.filmstripBeside) {
    return {
      width: Math.max(availableWidth - chrome.filmstripWidth - 10, 140),
      height: availableHeight,
    }
  }
  if (input.filmstripExpanded && !chrome.filmstripBeside) {
    return {
      width: availableWidth,
      height: Math.max(availableHeight - chrome.filmstripHeight - 8, 100),
    }
  }
  return { width: availableWidth, height: availableHeight }
}
