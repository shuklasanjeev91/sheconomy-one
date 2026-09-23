/**
 * Dedicated meeting orientation + responsive layout strategy.
 *
 * Breakpoints: Mobile → Tablet → Laptop → Desktop → Large Desktop
 * Portrait and landscape phone policies stay separate — never rotate portrait metrics.
 */

import {
  meetingViewportIsLandscape,
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

export type MeetingUiLayout = {
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

export type MeetingUiLayoutInput = {
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
  input: MeetingUiLayoutInput,
): MeetingOrientationPolicy {
  const width = Math.max(input.width, 1)
  const height = Math.max(input.height, 1)
  const shortest = Math.min(width, height)

  // Phone-class viewports (including landscape phones ~844×390) stay on phone
  // policies even when the long edge crosses the tablet width breakpoint.
  if (shortest < 500) {
    return meetingViewportIsLandscape(width, height) ? 'landscape-phone' : 'portrait-phone'
  }

  const responsive = resolveMeetingResponsiveLayout({
    width,
    height,
    isNative: input.isNative,
  })

  switch (responsive.breakpoint) {
    case 'mobile':
      return meetingViewportIsLandscape(width, height) ? 'landscape-phone' : 'portrait-phone'
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

export function resolveMeetingUiLayout(input: MeetingUiLayoutInput): MeetingUiLayout {
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
  const isLandscape = meetingViewportIsLandscape(width, height)
  // Zoom mobile (phones only): bottom sheets.
  // Zoom desktop / iPad (tablet+) and Zoom web (laptop+): side panels.
  const panelPresentation =
    policy === 'portrait-phone' || policy === 'landscape-phone'
      ? 'bottom-sheet'
      : responsive.panelPresentation
  const panelFullWidth = panelPresentation === 'bottom-sheet'

  if (
    policy === 'large-desktop' ||
    policy === 'desktop' ||
    policy === 'laptop' ||
    policy === 'tablet'
  ) {
    const filmstripBeside =
      policy === 'tablet' ? responsive.filmstripPlacement === 'side' : true
    const filmstripWidth =
      policy === 'large-desktop'
        ? 200
        : policy === 'desktop'
          ? 176
          : policy === 'laptop'
            ? 156
            : filmstripBeside
              ? 148
              : width - 40
    const horizontalPad = policy === 'tablet' ? 16 : policy === 'laptop' ? 20 : 24
    const controlsClearance = policy === 'tablet' ? (isLandscape ? 112 : 120) : 120
    const headerClearance = policy === 'tablet' ? (isLandscape ? 60 : 68) : 72
    return {
      policy,
      breakpoint: responsive.breakpoint,
      isLandscape,
      filmstripBeside,
      filmstripWidth,
      filmstripHeight: filmstripBeside
        ? Math.max(height - 200, 180)
        : policy === 'tablet'
          ? 96
          : Math.max(height - 200, 180),
      pipWidth: Math.max(filmstripWidth - 20, 132),
      pipHeight: filmstripBeside ? 88 : 78,
      headerClearance,
      controlsClearance,
      horizontalPad,
      stagePaddingTop: Math.max(safeTop, 12) + headerClearance,
      stagePaddingBottom: controlsClearance + safeBottom,
      stagePaddingLeft: horizontalPad + safeLeft,
      stagePaddingRight: horizontalPad + safeRight,
      panelTop: Math.max(safeTop, 8) + (policy === 'tablet' ? 60 : 68),
      panelBottom: controlsClearance + safeBottom,
      panelTrailingInset: 12 + safeRight,
      panelMaxWidthFraction: responsive.sidePanelWidthFraction,
      panelFullWidth,
      panelPresentation,
      compactControls: false,
      captionWideLayout: true,
      captionTopOffset: policy === 'tablet' ? (isLandscape ? 68 : 76) : 80,
      captionBottomOffset: controlsClearance + 16,
      captionSideInset: 16 + safeLeft,
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
    headerClearance: 72,
    controlsClearance: 108,
    horizontalPad: 12,
    stagePaddingTop: Math.max(safeTop, 12) + 72,
    stagePaddingBottom: 108 + safeBottom,
    stagePaddingLeft: 12 + safeLeft,
    stagePaddingRight: 12 + safeRight,
    panelTop: Math.max(safeTop, 8) + 72,
    panelBottom: 108 + safeBottom,
    panelTrailingInset: 12 + safeRight,
    panelMaxWidthFraction: 1,
    panelFullWidth: true,
    panelPresentation: 'bottom-sheet',
    compactControls: true,
    captionWideLayout: false,
    captionTopOffset: 76,
    captionBottomOffset: 120,
    captionSideInset: 12,
    galleryPreferWide: false,
    pageSize: responsive.pageSize,
  }
}

/** Usable stage box after UI insets + optional side filmstrip + Zoom-web side panel. */
export function meetingStageContentBox(input: {
  viewportWidth: number
  viewportHeight: number
  layout: MeetingUiLayout
  filmstripExpanded: boolean
  /** Extra trailing inset when a Zoom-web side panel (chat/people) is open. */
  stageTrailingInset?: number
}): { width: number; height: number } {
  const layout = input.layout
  const trailingInset = Math.max(input.stageTrailingInset ?? 0, 0)
  const availableWidth = Math.max(
    input.viewportWidth - layout.stagePaddingLeft - layout.stagePaddingRight - trailingInset,
    160,
  )
  const availableHeight = Math.max(
    input.viewportHeight - layout.stagePaddingTop - layout.stagePaddingBottom,
    120,
  )
  if (input.filmstripExpanded && layout.filmstripBeside) {
    return {
      width: Math.max(availableWidth - layout.filmstripWidth - 10, 140),
      height: availableHeight,
    }
  }
  if (input.filmstripExpanded && !layout.filmstripBeside) {
    return {
      width: availableWidth,
      // Extra gap so captions / share UI clear the filmstrip strip.
      height: Math.max(availableHeight - layout.filmstripHeight - 14, 100),
    }
  }
  return { width: availableWidth, height: availableHeight }
}
