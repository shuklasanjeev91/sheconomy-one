import { describe, expect, it } from 'vitest'

import { applyAnnotationEvent, emptyAnnotationSession } from '~/co-work/lib/meeting-annotation'
import { buildMeetingTranscriptArchive, transcriptArchiveToPlainText } from '~/co-work/lib/meeting-transcript-archive'
import { canOpenMeetingPopout } from '~/co-work/lib/meeting-dual-monitor'
import { defaultInterpretationChannelId, MEETING_INTERPRETATION_CHANNELS } from '~/co-work/lib/meeting-interpretation'
import type { LiveCaptionLine } from '~/co-work/lib/live-captions'

describe('meeting phase 3–4 helpers', () => {
  it('archives final caption lines to plain text', () => {
    const lines: LiveCaptionLine[] = [
      {
        id: '1',
        userId: 'u1',
        speaker: 'Ada',
        text: 'Hello',
        originalText: 'Hello',
        sourceLang: 'en',
        isFinal: true,
        timestamp: 1_700_000_000_000,
      },
      {
        id: '2',
        userId: 'u1',
        speaker: 'Ada',
        text: 'partial',
        originalText: 'partial',
        sourceLang: 'en',
        isFinal: false,
        timestamp: 1_700_000_000_100,
      },
    ]
    const entry = buildMeetingTranscriptArchive('m1', lines)
    expect(entry.lines).toHaveLength(1)
    expect(transcriptArchiveToPlainText(entry)).toContain('Ada: Hello')
  })

  it('manages annotation session state', () => {
    let session = emptyAnnotationSession()
    session = applyAnnotationEvent(session, { type: 'open' })
    expect(session.open).toBe(true)
    session = applyAnnotationEvent(session, {
      type: 'stroke',
      stroke: {
        id: 's1',
        color: '#fff',
        width: 2,
        points: [{ x: 1, y: 2 }],
        from: 'u1',
        createdAt: 1,
      },
    })
    expect(session.strokes).toHaveLength(1)
    session = applyAnnotationEvent(session, { type: 'clear' })
    expect(session.strokes).toHaveLength(0)
  })

  it('exposes interpretation channels and dual-monitor capability flag', () => {
    expect(defaultInterpretationChannelId()).toBe('floor')
    expect(MEETING_INTERPRETATION_CHANNELS.length).toBeGreaterThan(1)
    expect(typeof canOpenMeetingPopout()).toBe('boolean')
  })
})
