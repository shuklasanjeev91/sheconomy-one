export type CaptionOverlaySize = 'compact' | 'comfortable' | 'large'
export type CaptionOverlayPlacement = 'top' | 'bottom'

export type CaptionOverlayLayout = {
  placement: CaptionOverlayPlacement
  align: 'flex-start' | 'center' | 'flex-end'
  maxWidth: number
  maxHeight: number
}

const WIDTHS: Record<CaptionOverlaySize, number> = {
  compact: 320,
  comfortable: 420,
  large: 520,
}

const HEIGHTS: Record<CaptionOverlaySize, number> = {
  compact: 160,
  comfortable: 260,
  large: 340,
}

/**
 * Keep captions in a corner band so they never cover the shared-screen
 * focal area or the meeting toolbar. Desktop filmstrip is on the right;
 * mobile filmstrip is bottom.
 */
export function captionOverlayLayout(input: {
  size: CaptionOverlaySize
  placement: CaptionOverlayPlacement
  viewportWidth: number
  viewportHeight: number
  presentationSafe?: boolean
  wideLayout?: boolean
  /** Extra bottom clearance for landscape controls / home indicator. */
  bottomOffsetHint?: number
}): CaptionOverlayLayout {
  const requested = input.placement === 'top' ? 'top' : 'bottom'
  const placement =
    input.presentationSafe && !input.wideLayout ? 'top' : requested
  const maxWidth = Math.max(
    220,
    Math.min(
      WIDTHS[input.size],
      Math.round(input.viewportWidth * (input.wideLayout ? 0.42 : 0.92)),
    ),
  )
  const reservedBottom = input.bottomOffsetHint ?? (input.presentationSafe ? 260 : 220)
  const maxHeight = Math.min(
    HEIGHTS[input.size],
    Math.max(72, input.viewportHeight - reservedBottom),
  )

  return {
    placement,
    align: input.presentationSafe || input.wideLayout ? 'flex-start' : 'center',
    maxWidth,
    maxHeight,
  }
}
