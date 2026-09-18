import { supabase } from '~/lib/supabase/client'

export type MeetingQuestionStatus = 'open' | 'answered' | 'dismissed'

export type MeetingQuestion = {
  id: string
  meeting_id: string
  asker_id: string | null
  body: string
  anonymous: boolean
  upvote_count: number
  status: MeetingQuestionStatus
  answered_by: string | null
  pinned: boolean
  created_at: string
  askerName?: string | null
  iUpvoted?: boolean
}

export async function fetchMeetingQuestions(
  meetingId: string,
  userId: string,
): Promise<MeetingQuestion[]> {
  const { data, error } = await supabase
    .from('meeting_questions')
    .select(
      'id, meeting_id, asker_id, body, anonymous, upvote_count, status, answered_by, pinned, created_at',
    )
    .eq('meeting_id', meetingId)
    .order('pinned', { ascending: false })
    .order('upvote_count', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  if (!data?.length) return []

  const { data: votes } = await supabase
    .from('meeting_question_votes')
    .select('question_id')
    .eq('user_id', userId)
    .in(
      'question_id',
      data.map((row) => row.id),
    )

  const voted = new Set((votes ?? []).map((row) => row.question_id))
  const askerIds = [...new Set(data.map((row) => row.asker_id).filter(Boolean))] as string[]
  let names: Record<string, string> = {}
  if (askerIds.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', askerIds)
    names = Object.fromEntries(
      (profiles ?? []).map((profile) => [
        profile.id,
        profile.full_name || profile.username || 'Participant',
      ]),
    )
  }

  return data.map((row) => ({
    ...row,
    status: row.status as MeetingQuestionStatus,
    askerName: row.anonymous ? null : row.asker_id ? names[row.asker_id] ?? 'Participant' : null,
    iUpvoted: voted.has(row.id),
  }))
}

export async function askMeetingQuestion(input: {
  meetingId: string
  askerId: string
  body: string
  anonymous?: boolean
}): Promise<void> {
  const body = input.body.trim()
  if (!body) throw new Error('Enter a question.')
  const { error } = await supabase.from('meeting_questions').insert({
    meeting_id: input.meetingId,
    asker_id: input.askerId,
    body,
    anonymous: !!input.anonymous,
    status: 'open',
  })
  if (error) throw new Error(error.message)
}

export async function upvoteMeetingQuestion(questionId: string): Promise<void> {
  const { error } = await supabase.rpc('upvote_meeting_question', {
    p_question_id: questionId,
  })
  if (error) throw new Error(error.message)
}

export async function updateMeetingQuestionStatus(
  questionId: string,
  status: MeetingQuestionStatus,
  answeredBy?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('meeting_questions')
    .update({
      status,
      answered_by: status === 'answered' ? answeredBy ?? null : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', questionId)
  if (error) throw new Error(error.message)
}

export async function setMeetingQuestionPinned(questionId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase
    .from('meeting_questions')
    .update({ pinned, updated_at: new Date().toISOString() })
    .eq('id', questionId)
  if (error) throw new Error(error.message)
}
