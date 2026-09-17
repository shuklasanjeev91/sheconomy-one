import { describe, expect, it } from 'vitest'

import {
  endMeetingConfirmCopy,
  hostLeaveConfirmCopy,
  pickEligibleHostSuccessor,
  shouldEndLiveKitRoomAfterHostLeave,
} from '~/co-work/lib/meeting-end'

describe('meeting end / host leave policy', () => {
  it('uses the required End Meeting confirmation copy', () => {
    const copy = endMeetingConfirmCopy()
    expect(copy.title).toBe('End meeting for everyone?')
    expect(copy.cancelLabel).toBe('Cancel')
    expect(copy.confirmLabel).toBe('End Meeting')
  })

  it('prefers co-host then any admitted participant as successor', () => {
    expect(
      pickEligibleHostSuccessor({
        hostUserId: 'host',
        participants: [
          { user_id: 'host', role: 'host', status: 'admitted' },
          { user_id: 'p1', role: 'participant', status: 'admitted' },
          { user_id: 'c1', role: 'co_host', status: 'admitted' },
        ],
      })?.user_id,
    ).toBe('c1')

    expect(
      pickEligibleHostSuccessor({
        hostUserId: 'host',
        participants: [
          { user_id: 'host', role: 'host', status: 'admitted' },
          { user_id: 'p1', role: 'participant', status: 'admitted' },
        ],
      })?.user_id,
    ).toBe('p1')
  })

  it('explains transfer vs end when the host leaves', () => {
    const transfer = hostLeaveConfirmCopy({
      behavior: 'transfer_to_co_host',
      hostUserId: 'host',
      participants: [
        { user_id: 'host', role: 'host', status: 'admitted', is_host: true },
        { user_id: 'c1', role: 'co_host', status: 'admitted', is_host: false },
      ],
    })
    expect(transfer.willEndMeeting).toBe(false)
    expect(transfer.confirmLabel).toBe('Leave')

    const end = hostLeaveConfirmCopy({
      behavior: 'end',
      hostUserId: 'host',
      participants: [
        { user_id: 'host', role: 'host', status: 'admitted', is_host: true },
        { user_id: 'c1', role: 'co_host', status: 'admitted', is_host: false },
      ],
    })
    expect(end.willEndMeeting).toBe(true)
  })

  it('only tears down LiveKit after host leave when the meeting ended', () => {
    expect(
      shouldEndLiveKitRoomAfterHostLeave({
        previousRole: 'host',
        meetingStatus: 'ended',
      }),
    ).toBe(true)
    expect(
      shouldEndLiveKitRoomAfterHostLeave({
        previousRole: 'host',
        meetingStatus: 'active',
      }),
    ).toBe(false)
    expect(
      shouldEndLiveKitRoomAfterHostLeave({
        previousRole: 'participant',
        meetingStatus: 'ended',
      }),
    ).toBe(false)
  })
})
