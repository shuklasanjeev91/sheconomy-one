export type MeetingFloatingCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

type Size = { width: number; height: number }
type Point = { x: number; y: number }

export const MEETING_FLOATING_MARGIN = 12
/** Pointer travel (px) before a press on the floating tile becomes a drag instead of a swap. */
export const MEETING_FLOATING_DRAG_SLOP = 6

export function meetingFloatingTileSize(area: Size): Size {
  const portrait = area.height > area.width
  const maxWidth = portrait ? (area.width >= 600 ? 220 : 150) : 280
  const width = Math.round(
    Math.max(96, Math.min(maxWidth, area.width * (portrait ? 0.3 : 0.24))),
  )
  const height = Math.round(
    Math.min(area.height * 0.4, portrait ? (width * 4) / 3 : (width * 9) / 16),
  )
  return { width, height }
}

export function meetingFloatingCornerForPoint(point: Point, area: Size): MeetingFloatingCorner {
  const top = point.y < area.height / 2
  const left = point.x < area.width / 2
  return `${top ? 'top' : 'bottom'}-${left ? 'left' : 'right'}`
}

/** Top-left origin of the tile when snapped to `corner` inside `area`. */
export function meetingFloatingCornerOrigin(
  corner: MeetingFloatingCorner,
  area: Size,
  tile: Size,
  margin = MEETING_FLOATING_MARGIN,
): Point {
  return {
    x: corner.endsWith('left') ? margin : Math.max(margin, area.width - tile.width - margin),
    y: corner.startsWith('top') ? margin : Math.max(margin, area.height - tile.height - margin),
  }
}
