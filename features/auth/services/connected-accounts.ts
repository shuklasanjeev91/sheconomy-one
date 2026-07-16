import type { UserIdentity } from '@supabase/supabase-js'

import { linkOAuthIdentity, type OAuthProvider } from '~/features/auth/services/oauth'
import { supabase } from '~/lib/supabase/client'

export type ConnectedIdentity = {
  id: string
  provider: string
  email?: string | null
  identity: UserIdentity
}

export async function listConnectedIdentities(): Promise<{
  identities: ConnectedIdentity[]
  error: string | null
}> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) return { identities: [], error: error.message }
  if (!user) return { identities: [], error: 'Not signed in' }

  const identities = (user.identities ?? []).map((identity) => ({
    id: identity.identity_id ?? identity.id,
    provider: identity.provider,
    email:
      (identity.identity_data?.email as string | undefined) ??
      user.email ??
      null,
    identity,
  }))

  return { identities, error: null }
}

export async function linkSocialAccount(
  provider: OAuthProvider,
): Promise<{ error: string | null }> {
  return linkOAuthIdentity(provider)
}

export async function unlinkSocialAccount(
  identity: UserIdentity,
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.unlinkIdentity(identity)
  return { error: error?.message ?? null }
}
