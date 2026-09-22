export type WhiteboardTool =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'rect'
  | 'circle'
  | 'line'
  | 'text'
  | 'sticky'

export type WhiteboardPoint = { x: number; y: number }

export type WhiteboardStroke = {
  id: string
  from: string
  tool: WhiteboardTool
  color: string
  width: number
  points: WhiteboardPoint[]
  text?: string
}

export type WhiteboardSession = {
  active: boolean
  startedBy: string | null
  strokes: WhiteboardStroke[]
}

export const WHITEBOARD_MAX_STROKES = 400
export const WHITEBOARD_VIEW = { width: 1600, height: 900 }

export function emptyWhiteboardSession(): WhiteboardSession {
  return { active: false, startedBy: null, strokes: [] }
}

export function clampWhiteboardCoord(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

export function createWhiteboardStrokeId(userId: string, now = Date.now()): string {
  return `${userId}-${now}-${Math.random().toString(36).slice(2, 8)}`
}

export function appendWhiteboardPoint(
  points: WhiteboardPoint[],
  next: WhiteboardPoint,
  minDelta = 0.002,
): WhiteboardPoint[] {
  const point = {
    x: clampWhiteboardCoord(next.x),
    y: clampWhiteboardCoord(next.y),
  }
  const last = points[points.length - 1]
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < minDelta) return points
  if (points.length >= 240) {
    return [...points.slice(0, -1), point]
  }
  return [...points, point]
}

export function whiteboardPointsToPath(
  points: WhiteboardPoint[],
  width = WHITEBOARD_VIEW.width,
  height = WHITEBOARD_VIEW.height,
): string {
  if (points.length === 0) return ''
  const first = points[0]
  if (!first) return ''
  let d = `M ${first.x * width} ${first.y * height}`
  for (let i = 1; i < points.length; i++) {
    const pt = points[i]
    if (!pt) continue
    d += ` L ${pt.x * width} ${pt.y * height}`
  }
  return d
}

export function whiteboardShapeBox(points: WhiteboardPoint[]): {
  x: number
  y: number
  width: number
  height: number
} | null {
  const start = points[0]
  const end = points[points.length - 1]
  if (!start || !end) return null
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  }
}

export type WhiteboardEvent =
  | { type: 'open'; from: string }
  | { type: 'close' }
  | { type: 'stroke'; stroke: WhiteboardStroke }
  | { type: 'undo'; strokeId?: string; from?: string }
  | { type: 'clear' }

export function applyWhiteboardEvent(
  session: WhiteboardSession,
  event: WhiteboardEvent,
): WhiteboardSession {
  switch (event.type) {
    case 'open':
      return {
        active: true,
        startedBy: session.startedBy ?? event.from,
        strokes: session.active ? session.strokes : [],
      }
    case 'close':
      return emptyWhiteboardSession()
    case 'stroke': {
      if (session.strokes.some((row) => row.id === event.stroke.id)) return session
      return {
        active: true,
        startedBy: session.startedBy ?? event.stroke.from,
        strokes: [...session.strokes, event.stroke].slice(-WHITEBOARD_MAX_STROKES),
      }
    }
    case 'undo': {
      if (event.strokeId) {
        return { ...session, strokes: session.strokes.filter((row) => row.id !== event.strokeId) }
      }
      if (event.from) {
        for (let i = session.strokes.length - 1; i >= 0; i--) {
          if (session.strokes[i]?.from === event.from) {
            return {
              ...session,
              strokes: [...session.strokes.slice(0, i), ...session.strokes.slice(i + 1)],
            }
          }
        }
        return session
      }
      return { ...session, strokes: session.strokes.slice(0, -1) }
    }
    case 'clear':
      return { ...session, strokes: [] }
    default:
      return session
  }
}

export function lastLocalWhiteboardStrokeId(
  strokes: WhiteboardStroke[],
  userId: string,
): string | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    const row = strokes[i]
    if (row?.from === userId) return row.id
  }
  return null
}
