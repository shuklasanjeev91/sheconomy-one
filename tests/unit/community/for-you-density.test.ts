import { describe, expect, it } from 'vitest'

import {
  FOR_YOU_HARD_PRIORITY_IDS,
  FOR_YOU_SLOT,
  FOR_YOU_VISIBLE_CAP,
  selectVisibleForYouSlots,
  type ForYouSlotState,
} from '~/community/lib/for-you-density'


function slot(id: ForYouSlotState['id'], hasContent: boolean): ForYouSlotState {
  return { id, hasContent }
}

describe('selectVisibleForYouSlots', () => {
  it('excludes empty slots from visible and overflow', () => {
    const result = selectVisibleForYouSlots([
      slot(FOR_YOU_SLOT.networkInvitations, false),
      slot(FOR_YOU_SLOT.celebrations, true),
      slot(FOR_YOU_SLOT.hashtags, false),
    ])

    expect(result.contentIds).toEqual([FOR_YOU_SLOT.celebrations])
    expect(result.visibleIds).toEqual([FOR_YOU_SLOT.celebrations])
    expect(result.overflowIds).toEqual([])
  })

  it(`caps primary visible set at ${FOR_YOU_VISIBLE_CAP}`, () => {
    const result = selectVisibleForYouSlots([
      slot(FOR_YOU_SLOT.celebrations, true),
      slot(FOR_YOU_SLOT.profileCompletion, true),
      slot(FOR_YOU_SLOT.composeDraft, true),
      slot(FOR_YOU_SLOT.introductionInbox, true),
      slot(FOR_YOU_SLOT.recommendationInbox, true),
      slot(FOR_YOU_SLOT.jobs, true),
      slot(FOR_YOU_SLOT.events, true),
      slot(FOR_YOU_SLOT.groups, true),
    ])

    expect(result.visibleIds).toHaveLength(FOR_YOU_VISIBLE_CAP)
    expect(result.overflowIds.length).toBeGreaterThan(0)
    expect(result.contentIds).toHaveLength(8)
    for (const id of result.visibleIds) {
      expect(result.overflowIds).not.toContain(id)
    }
  })

  it('keeps hard-priority action strips in the visible set when they have content', () => {
    const softFlood = [
      slot(FOR_YOU_SLOT.celebrations, true),
      slot(FOR_YOU_SLOT.profileCompletion, true),
      slot(FOR_YOU_SLOT.composeDraft, true),
      slot(FOR_YOU_SLOT.introductionInbox, true),
      slot(FOR_YOU_SLOT.recommendationInbox, true),
      slot(FOR_YOU_SLOT.jobs, true),
      slot(FOR_YOU_SLOT.events, true),
      slot(FOR_YOU_SLOT.groups, true),
      slot(FOR_YOU_SLOT.companies, true),
      slot(FOR_YOU_SLOT.hashtags, true),
    ]

    const result = selectVisibleForYouSlots([
      ...softFlood,
      slot(FOR_YOU_SLOT.networkInvitations, true),
      slot(FOR_YOU_SLOT.unreadChat, true),
      slot(FOR_YOU_SLOT.meetingInvites, true),
    ])

    expect(result.visibleIds).toContain(FOR_YOU_SLOT.networkInvitations)
    expect(result.visibleIds).toContain(FOR_YOU_SLOT.unreadChat)
    expect(result.visibleIds).toContain(FOR_YOU_SLOT.meetingInvites)
    expect(result.visibleIds).toHaveLength(FOR_YOU_VISIBLE_CAP)

    for (const id of FOR_YOU_HARD_PRIORITY_IDS) {
      expect(result.overflowIds).not.toContain(id)
    }
  })

  it('See all overflow lists remaining content ids in priority order', () => {
    const result = selectVisibleForYouSlots([
      slot(FOR_YOU_SLOT.networkInvitations, true),
      slot(FOR_YOU_SLOT.unreadChat, true),
      slot(FOR_YOU_SLOT.meetingInvites, true),
      slot(FOR_YOU_SLOT.composeDraft, true),
      slot(FOR_YOU_SLOT.celebrations, true),
      slot(FOR_YOU_SLOT.jobs, true),
      slot(FOR_YOU_SLOT.hashtags, true),
    ])

    expect(result.visibleIds).toEqual([
      FOR_YOU_SLOT.networkInvitations,
      FOR_YOU_SLOT.unreadChat,
      FOR_YOU_SLOT.meetingInvites,
      FOR_YOU_SLOT.composeDraft,
      FOR_YOU_SLOT.celebrations,
    ])
    expect(result.overflowIds).toEqual([FOR_YOU_SLOT.jobs, FOR_YOU_SLOT.hashtags])
  })

  it('returns empty sets when nothing has content', () => {
    const result = selectVisibleForYouSlots([
      slot(FOR_YOU_SLOT.networkInvitations, false),
      slot(FOR_YOU_SLOT.jobs, false),
    ])

    expect(result).toEqual({
      visibleIds: [],
      overflowIds: [],
      contentIds: [],
    })
  })

  it('respects a custom maxVisible cap', () => {
    const result = selectVisibleForYouSlots(
      [
        slot(FOR_YOU_SLOT.networkInvitations, true),
        slot(FOR_YOU_SLOT.unreadChat, true),
        slot(FOR_YOU_SLOT.celebrations, true),
      ],
      { maxVisible: 2 },
    )

    expect(result.visibleIds).toEqual([
      FOR_YOU_SLOT.networkInvitations,
      FOR_YOU_SLOT.unreadChat,
    ])
    expect(result.overflowIds).toEqual([FOR_YOU_SLOT.celebrations])
  })
})
