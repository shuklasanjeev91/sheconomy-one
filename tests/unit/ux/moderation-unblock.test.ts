import { describe, expect, it, vi, beforeEach } from 'vitest'

const fromMock = vi.fn()

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import {
  invalidateFeedExclusionCache,
  unblockCommunityMember,
} from '~/community/lib/moderation'

describe('unblockCommunityMember', () => {
  beforeEach(() => {
    fromMock.mockReset()
    invalidateFeedExclusionCache()
  })

  it('deletes the block row and clears exclusion cache', async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: null })
    const eq1 = vi.fn(() => ({ eq: eq2 }))
    const del = vi.fn(() => ({ eq: eq1 }))
    fromMock.mockReturnValue({ delete: del })

    const result = await unblockCommunityMember('blocker-1', 'blocked-2')
    expect(result.error).toBeNull()
    expect(fromMock).toHaveBeenCalledWith('blocked_users')
    expect(del).toHaveBeenCalled()
    expect(eq1).toHaveBeenCalledWith('blocker_id', 'blocker-1')
    expect(eq2).toHaveBeenCalledWith('blocked_id', 'blocked-2')
  })

  it('surfaces delete errors', async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: { message: 'permission denied' } })
    const eq1 = vi.fn(() => ({ eq: eq2 }))
    const del = vi.fn(() => ({ eq: eq1 }))
    fromMock.mockReturnValue({ delete: del })

    const result = await unblockCommunityMember('a', 'b')
    expect(result.error).toBe('permission denied')
  })
})
