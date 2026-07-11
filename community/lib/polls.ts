import { supabase } from '~/lib/supabase/client'

/**
 * Cast (or toggle off) a vote for a community poll option. Re-selecting the
 * option you already picked removes your vote; picking another switches it.
 * Vote counts are kept in sync server-side by the `cast_poll_vote` RPC.
 */
export async function castPollVote(
  pollId: string,
  optionId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('cast_poll_vote', {
    p_poll_id: pollId,
    p_option_id: optionId,
    p_user_id: userId,
  })
  return { error: error?.message ?? null }
}
