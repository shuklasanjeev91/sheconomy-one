import { beforeEach, describe, expect, it, vi } from 'vitest'

const fromMock = vi.fn()

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import {
  fetchShopFollowState,
  followShop,
  unfollowShop,
} from '~/commerce/lib/shop-follows'

/**
 * SQL smoke checks (manual, against a non-prod shop):
 *
 * 1) Follow shop → owner notif
 *    insert into shop_follows (user_id, shop_id, status) values (<follower>, <shop>, 'active');
 *    select type from notifications where recipient_id = <owner> and type = 'shop_new_follower' order by created_at desc limit 1;
 *
 * 2) Publish listing → follower notif
 *    update listings set listing_status = 'active', is_active = true where id = <listing>;
 *    select type from notifications where recipient_id = <follower> and type = 'shop_follower_new_listing' order by created_at desc limit 1;
 */

describe('shop-follows', () => {
  beforeEach(() => {
    fromMock.mockReset()
  })

  it('fetchShopFollowState only treats active rows as following', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const eqStatus = vi.fn(() => ({ maybeSingle }))
    const eqShop = vi.fn(() => ({ eq: eqStatus }))
    const eqUser = vi.fn(() => ({ eq: eqShop }))
    const select = vi.fn(() => ({ eq: eqUser }))
    fromMock.mockReturnValue({ select })

    const result = await fetchShopFollowState('user-1', 'shop-1')
    expect(result).toEqual({ isFollowing: false, error: null })
    expect(fromMock).toHaveBeenCalledWith('shop_follows')
    expect(eqStatus).toHaveBeenCalledWith('status', 'active')
  })

  it('fetchShopFollowState returns following when an active row exists', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'f1' }, error: null })
    const eqStatus = vi.fn(() => ({ maybeSingle }))
    const eqShop = vi.fn(() => ({ eq: eqStatus }))
    const eqUser = vi.fn(() => ({ eq: eqShop }))
    const select = vi.fn(() => ({ eq: eqUser }))
    fromMock.mockReturnValue({ select })

    const result = await fetchShopFollowState('user-1', 'shop-1')
    expect(result.isFollowing).toBe(true)
    expect(result.error).toBeNull()
  })

  it('followShop upserts active status on (user_id, shop_id)', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    fromMock.mockReturnValue({ upsert })

    const result = await followShop('user-1', 'shop-1')
    expect(result.error).toBeNull()
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        shop_id: 'shop-1',
        status: 'active',
      }),
      { onConflict: 'user_id,shop_id' },
    )
  })

  it('followShop surfaces upsert errors instead of silently failing', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'rls denied' } })
    fromMock.mockReturnValue({ upsert })

    const result = await followShop('user-1', 'shop-1')
    expect(result.error).toBe('rls denied')
  })

  it('unfollowShop deletes the follow row', async () => {
    const eqShop = vi.fn().mockResolvedValue({ error: null })
    const eqUser = vi.fn(() => ({ eq: eqShop }))
    const del = vi.fn(() => ({ eq: eqUser }))
    fromMock.mockReturnValue({ delete: del })

    const result = await unfollowShop('user-1', 'shop-1')
    expect(result.error).toBeNull()
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1')
    expect(eqShop).toHaveBeenCalledWith('shop_id', 'shop-1')
  })
})
