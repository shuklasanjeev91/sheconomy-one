import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingleMock = vi.fn()
const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
const userEqMock = vi.fn(() => ({ select: selectMock }))
const idEqMock = vi.fn(() => ({ eq: userEqMock }))
const deleteMock = vi.fn(() => ({ eq: idEqMock }))
const fromMock = vi.fn(() => ({ delete: deleteMock }))

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { deletePostComment } from '~/community/lib/post-engagement'

describe('post comment deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('scopes deletion to both comment id and signed-in user id', async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: 'comment-1' }, error: null })

    await expect(deletePostComment('user-1', 'comment-1')).resolves.toEqual({ error: null })
    expect(fromMock).toHaveBeenCalledWith('comments')
    expect(deleteMock).toHaveBeenCalledOnce()
    expect(idEqMock).toHaveBeenCalledWith('id', 'comment-1')
    expect(userEqMock).toHaveBeenCalledWith('user_id', 'user-1')
    expect(selectMock).toHaveBeenCalledWith('id')
  })

  it('does not report success when RLS deletes no row', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })

    await expect(deletePostComment('user-1', 'other-comment')).resolves.toEqual({
      error: 'Comment not found or you cannot delete it.',
    })
  })
})
