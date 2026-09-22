import { describe, expect, it } from 'vitest'

import {
  appendWhiteboardPoint,
  applyWhiteboardEvent,
  emptyWhiteboardSession,
  lastLocalWhiteboardStrokeId,
  whiteboardPointsToPath,
  whiteboardShapeBox,
  type WhiteboardStroke,
} from '~/co-work/lib/meeting-whiteboard'

function stroke(partial?: Partial<WhiteboardStroke>): WhiteboardStroke {
  return {
    id: partial?.id ?? 's1',
    from: partial?.from ?? 'u1',
    tool: partial?.tool ?? 'pen',
    color: partial?.color ?? '#111827',
    width: partial?.width ?? 4,
    points: partial?.points ?? [
      { x: 0.1, y: 0.1 },
      { x: 0.2, y: 0.2 },
    ],
    text: partial?.text,
  }
}

describe('meeting whiteboard', () => {
  it('clamps and downsamples freehand points', () => {
    expect(appendWhiteboardPoint([], { x: -1, y: 2 })).toEqual([{ x: 0, y: 1 }])
    expect(appendWhiteboardPoint([{ x: 0.5, y: 0.5 }], { x: 0.5005, y: 0.5 })).toEqual([
      { x: 0.5, y: 0.5 },
    ])
    expect(appendWhiteboardPoint([{ x: 0.1, y: 0.1 }], { x: 0.4, y: 0.4 })).toEqual([
      { x: 0.1, y: 0.1 },
      { x: 0.4, y: 0.4 },
    ])
  })

  it('builds an SVG path from normalized points', () => {
    expect(whiteboardPointsToPath([{ x: 0, y: 0 }, { x: 1, y: 1 }], 100, 50)).toBe(
      'M 0 0 L 100 50',
    )
  })

  it('opens a shared session, appends strokes, and closes for everyone', () => {
    let session = emptyWhiteboardSession()
    session = applyWhiteboardEvent(session, { type: 'open', from: 'host' })
    expect(session.active).toBe(true)
    expect(session.startedBy).toBe('host')

    session = applyWhiteboardEvent(session, { type: 'stroke', stroke: stroke({ id: 'a' }) })
    session = applyWhiteboardEvent(session, { type: 'stroke', stroke: stroke({ id: 'a' }) })
    expect(session.strokes).toHaveLength(1)

    session = applyWhiteboardEvent(session, { type: 'undo', from: 'u1' })
    expect(session.strokes).toHaveLength(0)

    session = applyWhiteboardEvent(session, { type: 'stroke', stroke: stroke({ id: 'b' }) })
    session = applyWhiteboardEvent(session, { type: 'close' })
    expect(session).toEqual(emptyWhiteboardSession())
  })

  it('undoes the caller’s last stroke and reports its id', () => {
    const strokes = [
      stroke({ id: 'a', from: 'u1' }),
      stroke({ id: 'b', from: 'u2' }),
      stroke({ id: 'c', from: 'u1' }),
    ]
    expect(lastLocalWhiteboardStrokeId(strokes, 'u1')).toBe('c')
    expect(
      applyWhiteboardEvent(
        { active: true, startedBy: 'u1', strokes },
        { type: 'undo', strokeId: 'c' },
      ).strokes.map((row) => row.id),
    ).toEqual(['a', 'b'])
  })

  it('computes a shape box from the first and last points', () => {
    const box = whiteboardShapeBox([
      { x: 0.2, y: 0.1 },
      { x: 0.8, y: 0.7 },
    ])
    expect(box?.x).toBe(0.2)
    expect(box?.y).toBe(0.1)
    expect(box?.width).toBeCloseTo(0.6)
    expect(box?.height).toBeCloseTo(0.6)
  })
})
