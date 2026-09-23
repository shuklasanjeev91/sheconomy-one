/**
 * Meeting responsive breakpoints (web + native viewport width).
 *
 * Zoom mapping:
 * - phone only (<661 web, native shortest <600) → Zoom mobile UI
 *   (bottom sheets, compact Mute·Video·Chat·More·End dock)
 * - tablet / iPad + laptop+ (≥661 web, native tablet) → Zoom desktop / tablet UI
 *   (side panels, roomy Mute·Video·Participants·Chat·Share·Reactions·More·Leave dock)
 */

export type MeetingBreakpoint =
  | 'mobile'
  | 'tablet'
  | 'laptop'
  | 'desktop'
  | 'large-desktop'

export type MeetingPanelPresentation = 'bottom-sheet' | 'side'

export const MEETING_BREAKPOINTS = {
  /** ≥ tablet / iPad — Zoom desktop·tablet UI starts here */
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
  /** Mobile uses near-fullscreen stage; larger screens keep UI insets. */
  stageMode: 'fullscreen' | 'inset'
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
    // Phones stay Zoom-mobile; native tablets (iPad) use Zoom desktop/tablet UI.
    const shortest = options.shortestSide ?? w
    return shortest >= 600 ? 'tablet' : 'mobile'
  }
  if (w >= MEETING_BREAKPOINTS.largeDesktop) return 'large-desktop'
  if (w >= MEETING_BREAKPOINTS.desktop) return 'desktop'
  if (w >= MEETING_BREAKPOINTS.laptop) return 'laptop'
  if (w >= MEETING_BREAKPOINTS.tablet) return 'tablet'
  return 'mobile'
}

/**
 * Keyboard / mobile-browser UI can shrink height below width on a
 * still-portrait phone (e.g. 412×380). Treat as landscape only with a clear
 * wide aspect so chat does not unmount from a bottom sheet into a side dock.
 */
export function meetingViewportIsLandscape(width: number, height: number): boolean {
  const w = Math.max(width, 1)
  const h = Math.max(height, 1)
  return w / h >= 1.2
}

/**
 * Zoom desktop / iPad side panels from tablet up.
 * Phones always use bottom sheets (Zoom mobile).
 */
export function meetingPanelPresentation(
  breakpoint: MeetingBreakpoint,
  _options?: { isLandscape?: boolean },
): MeetingPanelPresentation {
  if (breakpoint === 'mobile') return 'bottom-sheet'
  return 'side'
}

export function resolveMeetingResponsiveLayout(input: {
  width: number
  height: number
  isNative?: boolean
}): MeetingResponsiveLayout {
  const width = Math.max(input.width, 1)
  const height = Math.max(input.height, 1)
  const isLandscape = meetingViewportIsLandscape(width, height)
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
        // Prefer denser pages so large meetings need fewer swipes.
        pageSize: height < 640 ? 6 : height < 780 ? 9 : 12,
      }
    case 'tablet':
      // Zoom desktop / tablet UI — side panels + roomy dock (not phone Mute·Chat·More).
      return {
        breakpoint,
        panelPresentation: 'side',
        toolbarPlacement: 'bottom',
        filmstripPlacement: isLandscape ? 'side' : 'bottom',
        stageMode: 'inset',
        galleryPreferWide: true,
        sidePanelWidthFraction: 0.4,
        sidePanelMaxWidth: 360,
        compactControls: false,
        pageSize: 12,
      }
    case 'laptop':
      return {
        breakpoint,
        panelPresentation: 'side',
        toolbarPlacement: 'bottom',
        filmstripPlacement: 'side',
        stageMode: 'inset',
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
        stageMode: 'inset',
        galleryPreferWide: true,
        sidePanelWidthFraction: 0.32,
        sidePanelMaxWidth: 400,
        compactControls: false,
        pageSize: 16,
      }
    case 'large-desktop':
      return {
        breakpoint,
        panelPresentation: 'side',
        toolbarPlacement: 'bottom',
        filmstripPlacement: 'side',
        stageMode: 'inset',
        galleryPreferWide: true,
        sidePanelWidthFraction: 0.28,
        sidePanelMaxWidth: 440,
        compactControls: false,
        pageSize: 25,
      }
  }
}
