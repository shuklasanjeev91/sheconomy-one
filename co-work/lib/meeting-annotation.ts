/**
 * Screen-share annotation strokes (synced via whiteboard-like local session).
 * Kept separate from the collaborative whiteboard modal.
 */

export type MeetingAnnotationStroke = {
  id: string
  color: string
  width: number
  points: Array<{ x: number; y: number }>
  from: string
  createdAt: number
}

export type MeetingAnnotationSession = {
  open: boolean
  strokes: MeetingAnnotationStroke[]
}

export function emptyAnnotationSession(): MeetingAnnotationSession {
  return { open: false, strokes: [] }
}

export function applyAnnotationEvent(
  current: MeetingAnnotationSession,
  event:
    | { type: 'open' }
    | { type: 'close' }
    | { type: 'stroke'; stroke: MeetingAnnotationStroke }
    | { type: 'clear' },
): MeetingAnnotationSession {
  switch (event.type) {
    case 'open':
      return { ...current, open: true }
    case 'close':
      return { open: false, strokes: [] }
    case 'stroke':
      return { ...current, open: true, strokes: [...current.strokes, event.stroke].slice(-200) }
    case 'clear':
      return { ...current, strokes: [] }
    default:
      return current
  }
}
