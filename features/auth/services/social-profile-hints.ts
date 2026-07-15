import type { User } from '@supabase/supabase-js'

export type SocialProfileHints = {
  fullName: string | null
  email: string | null
  avatarUrl: string | null
  providers: string[]
}

function metaString(meta: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = meta[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function resolveDisplayName(meta: Record<string, unknown>): string | null {
  const direct = metaString(meta, 'full_name', 'name')
  if (direct) return direct
  const given = metaString(meta, 'given_name', 'first_name')
  const family = metaString(meta, 'family_name', 'last_name')
  const joined = [given, family].filter(Boolean).join(' ').trim()
  return joined || null
}

function resolveAvatar(meta: Record<string, unknown>): string | null {
  return metaString(meta, 'avatar_url', 'picture', 'picture_url', 'avatar')
}

/**
 * Merge Google / Apple / LinkedIn identity metadata into reviewable profile hints.
 * Does not write to the database — callers confirm before applying.
 */
export function importSocialProfileHints(user: User | null | undefined): SocialProfileHints {
  if (!user) {
    return { fullName: null, email: null, avatarUrl: null, providers: [] }
  }

  const providers: string[] = []
  let fullName: string | null = null
  let email: string | null = user.email ?? null
  let avatarUrl: string | null = null

  const rootMeta = (user.user_metadata ?? {}) as Record<string, unknown>
  fullName = resolveDisplayName(rootMeta)
  avatarUrl = resolveAvatar(rootMeta)
  const metaEmail = metaString(rootMeta, 'email')
  if (!email && metaEmail) email = metaEmail

  for (const identity of user.identities ?? []) {
    const provider = identity.provider
    if (provider && provider !== 'email' && provider !== 'phone') {
      providers.push(provider)
    }
    const data = (identity.identity_data ?? {}) as Record<string, unknown>
    if (!fullName) fullName = resolveDisplayName(data)
    if (!avatarUrl) avatarUrl = resolveAvatar(data)
    if (!email) email = metaString(data, 'email')
  }

  return {
    fullName,
    email,
    avatarUrl,
    providers: Array.from(new Set(providers)),
  }
}
