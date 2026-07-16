import { supabase } from '~/lib/supabase/client'

export type NetworkInviteResult = {
  status: 'sent' | 'pending_signup' | string
  message?: string
  invite_id?: string
  invitee_user_id?: string
  connection_id?: string
  emailsSent?: number
  emailError?: string | null
  emailConfigured?: boolean
  error?: string
}

/** Invite by email via edge function (RPC + Resend when configured). */
export async function inviteNetworkByEmail(
  email: string,
  message?: string,
): Promise<NetworkInviteResult> {
  const { data, error } = await supabase.functions.invoke('network-invite', {
    body: {
      email: email.trim(),
      message: message?.trim() || undefined,
    },
  })

  if (error) {
    return { status: 'error', error: error.message, message: error.message }
  }

  const payload = (data ?? {}) as NetworkInviteResult
  if (payload.error) {
    return { status: 'error', error: payload.error, message: payload.error }
  }

  return payload
}
