import { describe, expect, it } from 'vitest'

import { applyMeetingJoinSecurityMedia } from '~/co-work/lib/meeting-join-enforcement'
import {
  copyMeetingTranscriptText,
  downloadMeetingTranscriptText,
  buildMeetingTranscriptArchive,
  transcriptArchiveToPlainText,
} from '~/co-work/lib/meeting-transcript-archive'
import { isMeetingPopoutMode, meetingPopoutQueryFlag } from '~/co-work/lib/meeting-dual-monitor'
import type { LiveCaptionLine } from '~/co-work/lib/live-captions'

describe('remaining Zoom parity helpers', () => {
  it('enforces mute/video-off on join for guests only', () => {
    expect(
      applyMeetingJoinSecurityMedia({
        audioEnabled: true,
        videoEnabled: true,
        security: { muteOnJoin: true, videoOffOnJoin: true },
        isHost: false,
      }),
    ).toEqual({ audioEnabled: false, videoEnabled: false })

    expect(
      applyMeetingJoinSecurityMedia({
        audioEnabled: true,
        videoEnabled: true,
        security: { muteOnJoin: true, videoOffOnJoin: true },
        isHost: true,
      }),
    ).toEqual({ audioEnabled: true, videoEnabled: true })
  })

  it('detects popout query flag', () => {
    expect(meetingPopoutQueryFlag()).toBe('popout')
    expect(isMeetingPopoutMode('?popout=1')).toBe(true)
    expect(isMeetingPopoutMode('?foo=1')).toBe(false)
  })

  it('builds transcript text for export helpers', () => {
    const lines: LiveCaptionLine[] = [
      {
        id: '1',
        userId: 'u1',
        speaker: 'Ada',
        text: 'Ship it',
        originalText: 'Ship it',
        sourceLang: 'en',
        isFinal: true,
        timestamp: 1_700_000_000_000,
      },
    ]
    const entry = buildMeetingTranscriptArchive('m1', lines)
    const text = transcriptArchiveToPlainText(entry)
    expect(text).toContain('Ada: Ship it')
    expect(typeof copyMeetingTranscriptText).toBe('function')
    expect(typeof downloadMeetingTranscriptText).toBe('function')
  })
})
