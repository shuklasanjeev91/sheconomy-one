import { beforeEach, describe, expect, it, vi } from 'vitest'

const maybeSingleMock = vi.fn()
const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
const eqMock = vi.fn(() => ({ select: selectMock }))
const deleteMock = vi.fn(() => ({ eq: eqMock }))
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
