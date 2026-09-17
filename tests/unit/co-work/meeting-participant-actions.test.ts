import { describe, expect, it } from 'vitest'

import { hostBulkActions, participantRowActions } from '../../../co-work/lib/meeting-participant-actions'

describe('meeting participant actions', () => {
  it('exposes Zoom-style row actions for hosts moderating participants', () => {
    expect(
      participantRowActions({
        viewerRole: 'host',
        targetRole: 'participant',
        isSelf: false,
        isMuted: false,
        isVideoOff: false,
      }),
    ).toEqual([
      'mute',
      'stop_video',
      'remove',
      'ask_to_mute',
      'make_co_host',
      'make_host',
    ])

    expect(
      participantRowActions({
        viewerRole: 'host',
        targetRole: 'participant',
        isSelf: false,
        isMuted: true,
        isVideoOff: true,
      }),
    ).toEqual(['ask_to_unmute', 'remove', 'ask_to_mute', 'make_co_host', 'make_host'])
  })

  it('hides self-actions and blocks co-host peer moderation', () => {
    expect(
      participantRowActions({
        viewerRole: 'host',
        targetRole: 'participant',
        isSelf: true,
        isMuted: false,
        isVideoOff: false,
      }),
    ).toEqual([])

    expect(
      participantRowActions({
        viewerRole: 'co_host',
        targetRole: 'co_host',
        isSelf: false,
        isMuted: false,
        isVideoOff: false,
      }),
    ).toEqual([])

    expect(
      participantRowActions({
        viewerRole: 'co_host',
        targetRole: 'participant',
        isSelf: false,
        isMuted: false,
        isVideoOff: false,
      }),
    ).toEqual(['mute', 'stop_video', 'remove', 'ask_to_mute'])
  })

  it('limits bulk host controls by role', () => {
    expect(hostBulkActions('host')).toEqual([
      'mute_all',
      'ask_all_to_unmute',
      'remove_all_except_host',
      'lock_meeting',
    ])
    expect(hostBulkActions('co_host')).toEqual(['ask_all_to_unmute'])
    expect(hostBulkActions('participant')).toEqual([])
  })
})
