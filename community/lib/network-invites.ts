import { supabase } from '~/lib/supabase/client'

export type NetworkInviteResult = {
  status: 'sent' | 'pending_signup' | string
  message?: string
  invite_id?: string
  invitee_user_id?: string
  connection_id?: string
  error?: string
}

/** Invite an existing member by email, or queue an invite for signup matching. */
export async function inviteNetworkByEmail(
  email: string,
  message?: string,
): Promise<NetworkInviteResult> {
  const { data, error } = await supabase.rpc('invite_network_by_email', {
    p_email: email.trim(),
    p_message: message?.trim() || null,
  })

  if (error) {
    return { status: 'error', error: error.message, message: error.message }
  }

  return (data ?? {}) as NetworkInviteResult
}
