import { describe, expect, it } from 'vitest'

import { interleaveCommunityFeed } from '~/community/lib/interleave-feed-suggestions'

function post(id: string) {
  return { id } as never
}

function ad(id: string, postId: string) {
  return {
    campaignId: id,
    post: post(postId),
    objective: 'awareness',
    callToAction: 'learn_more',
    destinationUrl: null,
  } as never
}

describe('sponsored community feed mixer', () => {
  it('places sponsored content after the configured organic interval', () => {
    const entries = interleaveCommunityFeed(
      Array.from({ length: 8 }, (_, index) => post(`post-${index + 1}`)),
      [],
      [ad('campaign-1', 'ad-post')],
      { sponsoredInterval: 6 },
    )

    expect(entries.map((entry) => entry.type)).toEqual([
      'post',
      'post',
      'post',
      'post',
      'post',
      'post',
      'sponsored',
      'post',
      'post',
    ])
  })

  it('does not duplicate a post already present organically', () => {
    const entries = interleaveCommunityFeed(
      Array.from({ length: 6 }, (_, index) => post(`post-${index + 1}`)),
      [],
      [ad('campaign-1', 'post-2')],
      { sponsoredInterval: 6 },
    )

    expect(entries.filter((entry) => entry.type === 'sponsored')).toHaveLength(0)
  })

  it('keeps recommendation and sponsored slots from stacking together', () => {
    const section = { kind: 'person', items: [] } as never
    const entries = interleaveCommunityFeed(
      Array.from({ length: 6 }, (_, index) => post(`post-${index + 1}`)),
      [section],
      [ad('campaign-1', 'ad-post')],
      { suggestionInterval: 3, sponsoredInterval: 6 },
    )

    expect(entries.map((entry) => entry.type)).toEqual([
      'post',
      'post',
      'post',
      'suggestion',
      'post',
      'post',
      'post',
      'sponsored',
    ])
  })
})
