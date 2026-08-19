import { beforeEach, describe, expect, it, vi } from 'vitest'

const fromMock = vi.fn()

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import {
  fetchShopFollowState,
  fetchFollowedShopIds,
  fetchFollowedShops,
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

  it('fetchFollowedShopIds returns active followed shop ids', async () => {
    const eqStatus = vi.fn().mockResolvedValue({
      data: [{ shop_id: 'shop-1' }, { shop_id: 'shop-2' }],
      error: null,
    })
    const eqUser = vi.fn(() => ({ eq: eqStatus }))
    const select = vi.fn(() => ({ eq: eqUser }))
    fromMock.mockReturnValue({ select })

    const result = await fetchFollowedShopIds('user-1')
    expect(result).toEqual({ ids: ['shop-1', 'shop-2'], error: null })
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1')
    expect(eqStatus).toHaveBeenCalledWith('status', 'active')
  })

  it('fetchFollowedShops hydrates followed shop summaries in follow order', async () => {
    const shopsIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'shop-1',
          shop_name: 'Shop One',
          slug: 'shop-one',
          logo_url: null,
          shop_description: 'First shop',
          average_rating: 4.8,
          total_reviews: 24,
          verified: true,
          shop_currency: 'INR',
        },
        {
          id: 'shop-2',
          shop_name: 'Shop Two',
          slug: 'shop-two',
          logo_url: null,
          shop_description: 'Second shop',
          average_rating: 4.4,
          total_reviews: 12,
          verified: false,
          shop_currency: 'INR',
        },
      ],
      error: null,
    })
    const shopsSelect = vi.fn(() => ({ in: shopsIn }))
    const followsLimit = vi.fn().mockResolvedValue({
      data: [
        { shop_id: 'shop-2', updated_at: '2026-08-19T08:00:00.000Z' },
        { shop_id: 'shop-1', updated_at: '2026-08-19T07:00:00.000Z' },
      ],
      error: null,
    })
    const followsOrder = vi.fn(() => ({ limit: followsLimit }))
    const followsStatus = vi.fn(() => ({ order: followsOrder }))
    const followsUser = vi.fn(() => ({ eq: followsStatus }))
    const followsSelect = vi.fn(() => ({ eq: followsUser }))

    fromMock.mockImplementation((table: string) => {
      if (table === 'shop_follows') return { select: followsSelect }
      if (table === 'shops') return { select: shopsSelect }
      return {}
    })

    const result = await fetchFollowedShops('user-1', 5)
    expect(result.error).toBeNull()
    expect(result.items.map((item) => item.id)).toEqual(['shop-2', 'shop-1'])
    expect(result.items[0]?.followed_at).toBe('2026-08-19T08:00:00.000Z')
    expect(shopsIn).toHaveBeenCalledWith('id', ['shop-2', 'shop-1'])
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
