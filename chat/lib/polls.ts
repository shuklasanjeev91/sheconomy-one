import { supabase } from '~/lib/supabase/client'

import type { MessagePollVote, PollResult } from './types'

type MessagePollVoteRow = {
  message_id: string
  user_id: string
  option_index: number
}

/** Fetch all poll votes for the given poll messages. */
export async function fetchMessagePollVotes(
  messageIds: string[],
): Promise<MessagePollVote[]> {
  if (messageIds.length === 0) return []
  const { data, error } = await supabase
    .from('message_poll_votes')
    .select('message_id, user_id, option_index')
    .in('message_id', messageIds)
  if (error || !data) return []
  return (data as MessagePollVoteRow[]).map((row) => ({
    messageId: row.message_id,
    userId: row.user_id,
    optionIndex: row.option_index,
  }))
}

/**
 * Cast (or toggle off) a vote on a chat poll message. Re-tapping the option you
 * already picked clears it; picking another switches your vote. The
 * `cast_message_poll_vote` RPC enforces single-choice server-side.
 */
export async function castMessagePollVote(
  messageId: string,
  userId: string,
  optionIndex: number,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('cast_message_poll_vote', {
    p_message_id: messageId,
    p_user_id: userId,
    p_option_index: optionIndex,
  })
  return { error: error?.message ?? null }
}

/** Aggregate raw votes into per-option counts for one poll message. */
export function buildPollResult(
  votes: MessagePollVote[],
  optionCount: number,
  currentUserId: string | null,
): PollResult {
  const counts = new Array(optionCount).fill(0) as number[]
  let myOptionIndex: number | null = null
  for (const vote of votes) {
    if (vote.optionIndex >= 0 && vote.optionIndex < optionCount) {
      counts[vote.optionIndex] += 1
    }
    if (currentUserId && vote.userId === currentUserId) {
      myOptionIndex = vote.optionIndex
    }
  }
  const total = counts.reduce((sum, value) => sum + value, 0)
  return { counts, total, myOptionIndex }
}
