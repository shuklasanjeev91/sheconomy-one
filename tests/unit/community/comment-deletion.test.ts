import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingleMock = vi.fn()
const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
const eqMock = vi.fn(() => ({ select: selectMock }))
const deleteMock = vi.fn(() => ({ eq: eqMock }))
const updateUserEqMock = vi.fn(() => ({ select: selectMock }))
const updateIdEqMock = vi.fn(() => ({ eq: updateUserEqMock }))
const updateMock = vi.fn(() => ({ eq: updateIdEqMock }))
const fromMock = vi.fn(() => ({ delete: deleteMock, update: updateMock }))

vi.mock('~/lib/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

import { deletePostComment, updatePostComment } from '~/community/lib/post-engagement'

describe('post comment deletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters on the comment id alone so post authors can moderate their post', async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: 'comment-1' }, error: null })

    await expect(deletePostComment('comment-1')).resolves.toEqual({ error: null })
    expect(fromMock).toHaveBeenCalledWith('comments')
    expect(deleteMock).toHaveBeenCalledOnce()
    expect(eqMock).toHaveBeenCalledExactlyOnceWith('id', 'comment-1')
    expect(selectMock).toHaveBeenCalledWith('id')
  })

  it('does not report success when RLS deletes no row', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })

    await expect(deletePostComment('someone-elses-comment')).resolves.toEqual({
      error: 'Comment not found or you cannot delete it.',
    })
  })

  it('surfaces database errors', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: { message: 'permission denied' } })

    await expect(deletePostComment('comment-1')).resolves.toEqual({
      error: 'permission denied',
    })
  })
})

describe('post comment editing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates content and scopes the edit to the comment author', async () => {
    maybeSingleMock.mockResolvedValue({ data: { id: 'comment-1' }, error: null })

    await expect(updatePostComment('user-1', 'comment-1', ' Updated comment ')).resolves.toEqual({
      error: null,
    })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Updated comment',
        is_edited: true,
      }),
    )
    expect(updateIdEqMock).toHaveBeenCalledWith('id', 'comment-1')
    expect(updateUserEqMock).toHaveBeenCalledWith('user_id', 'user-1')
  })

  it('rejects an empty edited comment without calling the database', async () => {
    await expect(updatePostComment('user-1', 'comment-1', '   ')).resolves.toEqual({
      error: 'Comment cannot be empty.',
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('does not report success when the authenticated user does not own the comment', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null })

    await expect(updatePostComment('user-1', 'comment-2', 'Nope')).resolves.toEqual({
      error: 'Comment not found or you cannot edit it.',
    })
  })
})
