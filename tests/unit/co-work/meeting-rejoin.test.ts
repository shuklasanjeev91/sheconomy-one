import { describe, expect, it } from 'vitest'

import { createMeetingSessionId } from '~/co-work/lib/meetings'

describe('meeting reconnect sessions', () => {
  it('creates valid per-mount UUID session identifiers', () => {
    const first = createMeetingSessionId()
    const second = createMeetingSessionId()
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    expect(first).toMatch(uuid)
    expect(second).toMatch(uuid)
    expect(second).not.toBe(first)
  })
})
