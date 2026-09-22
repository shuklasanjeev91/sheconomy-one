import { describe, expect, it } from 'vitest'

import { applyMeetingReactionTone, MEETING_REACTIONS } from '~/co-work/lib/meeting-reactions'
import { meetingAudioCaptureConstraints, parseMeetingMediaPrefs } from '~/co-work/lib/meeting-media-prefs'
import { parseMeetingGalleryPrefs } from '~/co-work/lib/meeting-gallery-prefs'
import { formatPersonalMeetingDisplayCode } from '~/co-work/lib/meeting-pmi'

describe('Zoom parity batch — reactions, media, PMI, gallery prefs', () => {
  it('applies skin tone modifiers to toneable reactions only', () => {
    expect(applyMeetingReactionTone('👍', '🏽')).toBe('👍🏽')
    expect(applyMeetingReactionTone('❤️', '🏽')).toBe('❤️')
    expect(MEETING_REACTIONS.some((row) => row.toneable)).toBe(true)
  })

  it('builds original-sound capture constraints', () => {
    expect(meetingAudioCaptureConstraints({ originalSound: true })).toEqual({
      echoCancellation: true,
      noiseSuppression: false,
      autoGainControl: false,
    })
    expect(meetingAudioCaptureConstraints({ noiseSuppression: false }).noiseSuppression).toBe(false)
  })

  it('parses media and gallery prefs safely', () => {
    expect(parseMeetingMediaPrefs({ originalSound: true, hdVideo: false }).hdVideo).toBe(false)
    expect(parseMeetingGalleryPrefs({ viewMode: 'speaker', denseGallery: true })).toEqual({
      viewMode: 'speaker',
      denseGallery: true,
      hideSelfView: undefined,
      participantStripMinimized: undefined,
    })
  })

  it('formats a PMI display code from user id', () => {
    expect(formatPersonalMeetingDisplayCode('abc123def456')).toMatch(/[A-Z0-9]{3} [A-Z0-9]{3} [A-Z0-9]{4}/)
  })

  it('exposes scheduleOnPersonalMeeting helper', async () => {
    const mod = await import('~/co-work/lib/meeting-pmi')
    expect(typeof mod.scheduleOnPersonalMeeting).toBe('function')
    expect(typeof mod.startOrReusePersonalMeeting).toBe('function')
  })
})
