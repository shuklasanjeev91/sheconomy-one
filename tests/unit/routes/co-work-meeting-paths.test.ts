import { describe, expect, it } from 'vitest'

import {
  isCoWorkLivePath,
  isCoWorkMeetingRoomPath,
} from '~/lib/routes'

describe('isCoWorkMeetingRoomPath', () => {
  it('matches lobby, live, and ended meeting URLs', () => {
    expect(isCoWorkMeetingRoomPath('/co-work/meeting/ABC123')).toBe(true)
    expect(isCoWorkMeetingRoomPath('/co-work/meeting/ABC123/live')).toBe(true)
    expect(isCoWorkMeetingRoomPath('/co-work/meeting/ABC123/ended')).toBe(true)
    expect(isCoWorkMeetingRoomPath('/cowork/meeting/ABC123')).toBe(true)
  })

  it('does not match the meetings list or join code entry', () => {
    expect(isCoWorkMeetingRoomPath('/co-work/meetings')).toBe(false)
    expect(isCoWorkMeetingRoomPath('/co-work/join')).toBe(false)
    expect(isCoWorkMeetingRoomPath('/co-work')).toBe(false)
  })
})

describe('isCoWorkLivePath', () => {
  it('matches /live and ?live=1 lobby deep links', () => {
    expect(isCoWorkLivePath('/co-work/meeting/ABC/live')).toBe(true)
    expect(isCoWorkLivePath('/co-work/meeting/ABC', '?live=1')).toBe(true)
    expect(isCoWorkLivePath('/co-work/meeting/ABC')).toBe(false)
  })
})
