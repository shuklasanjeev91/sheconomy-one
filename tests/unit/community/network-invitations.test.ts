import { describe, expect, it } from 'vitest'

import { selectNetworkInvitations } from '~/community/lib/network-invitations'
import type { NetworkMember } from '~/community/lib/network'

function member(id: string): NetworkMember {
  return {
    user_id: id,
    username: id,
    full_name: `Member ${id}`,
    headline: 'Founder',
    avatar_url: null,
    location: null,
    industry: null,
    is_verified: false,
    mutual_count: 2,
    connection_id: `conn-${id}`,
    connection_status: 'pending',
    is_sender: false,
  }
}

describe('selectNetworkInvitations', () => {
  it('returns the first N pending invitations', () => {
    const items = selectNetworkInvitations(
      [member('a'), member('b'), member('c'), member('d'), member('e')],
      3,
    )

    expect(items.map((item) => item.user_id)).toEqual(['a', 'b', 'c'])
  })

  it('returns an empty list when there are no invitations', () => {
    expect(selectNetworkInvitations([])).toEqual([])
  })
})
