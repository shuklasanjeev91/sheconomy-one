import { beforeEach, describe, expect, it, vi } from 'vitest'

const eqCommentMock = vi.fn()
const eqUserMock = vi.fn(() => ({ eq: eqCommentMock }))
const deleteMock = vi.fn(() => ({ eq: eqUserMock }))
const updateMock = vi.fn(() => ({ eq: eqUserMock }))
const insertMock = vi.fn()
const fromMock = vi.fn(() => ({ delete: deleteMock, update: updateMock, insert: insertMock }))

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { toggleCommentLike } from '~/community/lib/post-engagement'

describe('comment emoji reactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eqCommentMock.mockResolvedValue({ error: null })
    insertMock.mockResolvedValue({ error: null })
  })

  it('inserts a selected reaction type for a new comment reaction', async () => {
    await expect(toggleCommentLike('user-1', 'comment-1', false, 'love')).resolves.toEqual({
      error: null,
    })

    expect(fromMock).toHaveBeenCalledWith('comment_likes')
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'user-1',
      comment_id: 'comment-1',
      reaction_type: 'love',
    })
  })

  it('updates the reaction type when the user picks a different emoji', async () => {
    await expect(toggleCommentLike('user-1', 'comment-1', true, 'funny', 'like')).resolves.toEqual({
      error: null,
    })

    expect(updateMock).toHaveBeenCalledWith({ reaction_type: 'funny' })
    expect(eqUserMock).toHaveBeenCalledWith('user_id', 'user-1')
    expect(eqCommentMock).toHaveBeenCalledWith('comment_id', 'comment-1')
  })

  it('removes the reaction when the same emoji is selected again', async () => {
    await expect(toggleCommentLike('user-1', 'comment-1', true, 'like', 'like')).resolves.toEqual({
      error: null,
    })

    expect(deleteMock).toHaveBeenCalledOnce()
    expect(eqUserMock).toHaveBeenCalledWith('user_id', 'user-1')
    expect(eqCommentMock).toHaveBeenCalledWith('comment_id', 'comment-1')
  })
})
