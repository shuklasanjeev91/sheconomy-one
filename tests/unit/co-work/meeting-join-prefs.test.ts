import { describe, expect, it } from 'vitest'

import {
  meetingJoinPrefsFromCheckboxes,
  parseMeetingJoinPrefs,
} from '../../../co-work/lib/meeting-join-prefs'

describe('meeting join prefs', () => {
  it('maps Zoom-style join checkboxes to media publish flags', () => {
    expect(
      meetingJoinPrefsFromCheckboxes({ doNotConnectAudio: false, turnOffVideo: false }),
    ).toEqual({ audioEnabled: true, videoEnabled: true })
    expect(
      meetingJoinPrefsFromCheckboxes({ doNotConnectAudio: true, turnOffVideo: true }),
    ).toEqual({ audioEnabled: false, videoEnabled: false })
  })

  it('parses stored join prefs without treating missing flags as muted', () => {
    expect(parseMeetingJoinPrefs({ displayName: '  Ada  ' })).toEqual({
      audioEnabled: true,
      videoEnabled: true,
      displayName: 'Ada',
    })
    expect(parseMeetingJoinPrefs({ audioEnabled: false, videoEnabled: true })).toEqual({
      audioEnabled: false,
      videoEnabled: true,
      displayName: undefined,
    })
    expect(parseMeetingJoinPrefs(null)).toBeNull()
  })
})
