export type PostVisibility = 'public' | 'connections' | 'private'

export const POST_VISIBILITY_OPTIONS: PostVisibility[] = ['public', 'connections', 'private']

export const POST_AUDIENCES: Record<
  PostVisibility,
  { label: string; description: string }
> = {
  public: {
    label: 'Public',
    description: 'Anyone can see this post',
  },
  connections: {
    label: 'Connections',
    description: 'Only people you are connected with',
  },
  private: {
    label: 'Private',
    description: 'Only you can see this post',
  },
}

/** Unknown or older rows stay public so existing posts do not disappear. */
export function normalizePostVisibility(value: string | null | undefined): PostVisibility {
  if (value === 'connections' || value === 'connection' || value === 'connections_only') {
    return 'connections'
  }
  if (value === 'private' || value === 'only_me') return 'private'
  return 'public'
}

export function postVisibleTo(input: {
  visibility: string | null | undefined
  authorId: string | null | undefined
  viewerId: string | null | undefined
  connectedAuthorIds?: ReadonlySet<string>
}): boolean {
  const visibility = normalizePostVisibility(input.visibility)
  if (visibility === 'public') return true
  if (!input.viewerId || !input.authorId) return false
  if (input.authorId === input.viewerId) return true
  if (visibility === 'private') return false
  return input.connectedAuthorIds?.has(input.authorId) ?? false
}
