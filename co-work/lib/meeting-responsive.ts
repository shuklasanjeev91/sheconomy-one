/**
 * Meeting responsive breakpoints (web + native viewport width).
 *
 * Mobile → Tablet → Laptop → Desktop → Large Desktop
 */

export type MeetingBreakpoint =
  | 'mobile'
  | 'tablet'
  | 'laptop'
  | 'desktop'
  | 'large-desktop'

export type MeetingPanelPresentation = 'bottom-sheet' | 'side'

export const MEETING_BREAKPOINTS = {
  /** ≥ tablet */
  tablet: 661,
  /** ≥ laptop */
  laptop: 861,
  /** ≥ desktop */
  desktop: 1021,
  /** ≥ large desktop */
  largeDesktop: 1281,
} as const

export type MeetingResponsiveLayout = {
  breakpoint: MeetingBreakpoint
  /** Chat / Participants / Invite presentation. */
  panelPresentation: MeetingPanelPresentation
  /** Dock always sits on the bottom across breakpoints. */
  toolbarPlacement: 'bottom'
  /** Participant filmstrip placement for speaker/share immersion. */
  filmstripPlacement: 'bottom' | 'side'
  /** Mobile uses near-fullscreen stage; larger screens keep chrome insets. */
  stageMode: 'fullscreen' | 'chrome-inset'
  galleryPreferWide: boolean
  sidePanelWidthFraction: number
  sidePanelMaxWidth: number
  compactControls: boolean
  pageSize: number
}

export function resolveMeetingBreakpoint(
  width: number,
  options?: { isNative?: boolean; shortestSide?: number },
): MeetingBreakpoint {
  const w = Math.max(width, 1)
  if (options?.isNative) {
    // Native chrome stays touch-first: phones = mobile, tablets = tablet.
    const shortest = options.shortestSide ?? w
    return shortest >= 600 ? 'tablet' : 'mobile'
  }
  if (w >= MEETING_BREAKPOINTS.largeDesktop) return 'large-desktop'
  if (w >= MEETING_BREAKPOINTS.desktop) return 'desktop'
  if (w >= MEETING_BREAKPOINTS.laptop) return 'laptop'
  if (w >= MEETING_BREAKPOINTS.tablet) return 'tablet'
  return 'mobile'
}

export function meetingPanelPresentation(
  breakpoint: MeetingBreakpoint,
  options?: { isLandscape?: boolean },
): MeetingPanelPresentation {
  if (breakpoint === 'mobile') return 'bottom-sheet'
  // Tablet portrait stays sheet-based so chat/people don't crush the stage.
  if (breakpoint === 'tablet' && !options?.isLandscape) return 'bottom-sheet'
  return 'side'
}

export function resolveMeetingResponsiveLayout(input: {
  width: number
  height: number
  isNative?: boolean
}): MeetingResponsiveLayout {
  const width = Math.max(input.width, 1)
  const height = Math.max(input.height, 1)
  const isLandscape = width > height
  const breakpoint = resolveMeetingBreakpoint(width, {
    isNative: input.isNative,
    shortestSide: Math.min(width, height),
  })
  const panelPresentation = meetingPanelPresentation(breakpoint, { isLandscape })

  switch (breakpoint) {
    case 'mobile':
      return {
        breakpoint,
        panelPresentation,
        toolbarPlacement: 'bottom',
        filmstripPlacement: isLandscape ? 'side' : 'bottom',
        stageMode: 'fullscreen',
        galleryPreferWide: isLandscape,
        sidePanelWidthFraction: 1,
        sidePanelMaxWidth: width,
        compactControls: true,
        pageSize: 9,
      }
    case 'tablet':
      return {
        breakpoint,
        panelPresentation,
        toolbarPlacement: 'bottom',
        filmstripPlacement: isLandscape || width >= 900 ? 'side' : 'bottom',
        stageMode: 'chrome-inset',
        galleryPreferWide: true,
        sidePanelWidthFraction: isLandscape ? 0.4 : 0.48,
        sidePanelMaxWidth: 420,
        compactControls: false,
        pageSize: 9,
      }
    case 'laptop':
      return {
        breakpoint,
        panelPresentation: 'side',
        toolbarPlacement: 'bottom',
        filmstripPlacement: 'side',
        stageMode: 'chrome-inset',
        galleryPreferWide: true,
        sidePanelWidthFraction: 0.34,
        sidePanelMaxWidth: 380,
        compactControls: false,
        pageSize: 12,
      }
    case 'desktop':
      return {
        breakpoint,
        panelPresentation: 'side',
        toolbarPlacement: 'bottom',
        filmstripPlacement: 'side',
        stageMode: 'chrome-inset',
        galleryPreferWide: true,
        sidePanelWidthFraction: 0.32,
        sidePanelMaxWidth: 400,
        compactControls: false,
        pageSize: 12,
      }
    case 'large-desktop':
      return {
        breakpoint,
        panelPresentation: 'side',
        toolbarPlacement: 'bottom',
        filmstripPlacement: 'side',
        stageMode: 'chrome-inset',
        galleryPreferWide: true,
        sidePanelWidthFraction: 0.28,
        sidePanelMaxWidth: 440,
        compactControls: false,
        pageSize: 16,
      }
  }
}
