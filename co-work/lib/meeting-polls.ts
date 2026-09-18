import { supabase } from '~/lib/supabase/client'

export type MeetingPollStatus = 'open' | 'shared' | 'closed'

export type MeetingPollOption = {
  id: string
  poll_id: string
  option_text: string
  sort_order: number
  vote_count: number
}

export type MeetingPoll = {
  id: string
  meeting_id: string
  created_by: string
  question: string
  allow_multiple: boolean
  anonymous: boolean
  status: MeetingPollStatus
  created_at: string
  closed_at: string | null
  options: MeetingPollOption[]
  myOptionIds: string[]
}

export async function fetchMeetingPolls(meetingId: string, userId: string): Promise<MeetingPoll[]> {
  const { data: polls, error } = await supabase
    .from('meeting_polls')
    .select('id, meeting_id, created_by, question, allow_multiple, anonymous, status, created_at, closed_at')
    .eq('meeting_id', meetingId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  if (!polls?.length) return []

  const pollIds = polls.map((p) => p.id)
  const { data: options, error: optionsError } = await supabase
    .from('meeting_poll_options')
    .select('id, poll_id, option_text, sort_order, vote_count')
    .in('poll_id', pollIds)
    .order('sort_order', { ascending: true })
  if (optionsError) throw new Error(optionsError.message)

  const { data: votes, error: votesError } = await supabase
    .from('meeting_poll_votes')
    .select('poll_id, option_id')
    .eq('user_id', userId)
    .in('poll_id', pollIds)
  if (votesError) throw new Error(votesError.message)

  return polls.map((poll) => ({
    ...poll,
    status: poll.status as MeetingPollStatus,
    options: (options ?? [])
      .filter((option) => option.poll_id === poll.id)
      .map((option) => ({
        id: option.id,
        poll_id: option.poll_id,
        option_text: option.option_text,
        sort_order: option.sort_order,
        vote_count: option.vote_count,
      })),
    myOptionIds: (votes ?? [])
      .filter((vote) => vote.poll_id === poll.id)
      .map((vote) => vote.option_id),
  }))
}

export async function createMeetingPoll(input: {
  meetingId: string
  createdBy: string
  question: string
  options: string[]
  allowMultiple?: boolean
  anonymous?: boolean
}): Promise<string> {
  const cleaned = input.options.map((text) => text.trim()).filter(Boolean).slice(0, 6)
  if (cleaned.length < 2) throw new Error('Add at least two options.')
  const { data: poll, error } = await supabase
    .from('meeting_polls')
    .insert({
      meeting_id: input.meetingId,
      created_by: input.createdBy,
      question: input.question.trim(),
      allow_multiple: !!input.allowMultiple,
      anonymous: !!input.anonymous,
      status: 'open',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)

  const { error: optionsError } = await supabase.from('meeting_poll_options').insert(
    cleaned.map((option_text, sort_order) => ({
      poll_id: poll.id,
      option_text,
      sort_order,
      vote_count: 0,
    })),
  )
  if (optionsError) throw new Error(optionsError.message)
  return poll.id
}

export async function castMeetingPollVote(pollId: string, optionId: string): Promise<void> {
  const { error } = await supabase.rpc('cast_meeting_poll_vote', {
    p_poll_id: pollId,
    p_option_id: optionId,
  })
  if (error) throw new Error(error.message)
}

export async function setMeetingPollStatus(
  pollId: string,
  status: MeetingPollStatus,
): Promise<void> {
  const { error } = await supabase
    .from('meeting_polls')
    .update({
      status,
      closed_at: status === 'closed' ? new Date().toISOString() : null,
    })
    .eq('id', pollId)
  if (error) throw new Error(error.message)
}
