import { describe, expect, it } from 'vitest'

import { rankNetworkSuggestions } from '~/community/lib/network-suggestions'

function member(userId: string) {
  return {
    user_id: userId,
    username: null,
    full_name: userId,
    headline: null,
    avatar_url: null,
    location: null,
    industry: null,
    is_verified: false,
    mutual_count: 0,
    connection_id: null,
    connection_status: null,
    is_sender: false,
  }
}

/**
 * Raw profile discovery backs these rails whenever the suggestion RPC is empty,
 * and it knows nothing about the viewer's network — so anyone already connected
 * or mid-request has to be filtered out before it reaches "People you may know".
 */
describe('rankNetworkSuggestions', () => {
  it('drops members the viewer already has a relationship with', () => {
    const ranked = rankNetworkSuggestions(
      [member('connected'), member('invited'), member('stranger')],
      { dismissedIds: [], excludeUserIds: ['connected', 'invited'] },
    )

    expect(ranked.map((item) => item.user_id)).toEqual(['stranger'])
  })

  it('still drops dismissed members alongside related ones', () => {
    const ranked = rankNetworkSuggestions(
      [member('connected'), member('dismissed'), member('stranger')],
      { dismissedIds: ['dismissed'], excludeUserIds: ['connected'] },
    )

    expect(ranked.map((item) => item.user_id)).toEqual(['stranger'])
  })

  it('keeps everyone when no exclusions are supplied', () => {
    const ranked = rankNetworkSuggestions([member('a'), member('b')], { dismissedIds: [] })

    expect(ranked.map((item) => item.user_id)).toEqual(['a', 'b'])
  })
})
