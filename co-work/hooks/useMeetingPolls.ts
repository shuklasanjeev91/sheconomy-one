import { useCallback, useEffect, useState } from 'react'

import {
  castMeetingPollVote,
  createMeetingPoll,
  fetchMeetingPolls,
  setMeetingPollStatus,
  type MeetingPoll,
  type MeetingPollStatus,
} from '~/co-work/lib/meeting-polls'

type UseMeetingPollsOptions = {
  meetingId: string
  userId: string
  enabled?: boolean
}

export function useMeetingPolls({ meetingId, userId, enabled = true }: UseMeetingPollsOptions) {
  const [polls, setPolls] = useState<MeetingPoll[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!meetingId || !userId || !enabled) return
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchMeetingPolls(meetingId, userId)
      setPolls(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load polls')
    } finally {
      setLoading(false)
    }
  }, [enabled, meetingId, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const createPoll = useCallback(
    async (input: { question: string; options: string[] }) => {
      await createMeetingPoll({
        meetingId,
        createdBy: userId,
        question: input.question,
        options: input.options,
      })
      await refresh()
    },
    [meetingId, refresh, userId],
  )

  const vote = useCallback(
    async (pollId: string, optionId: string) => {
      await castMeetingPollVote(pollId, optionId)
      await refresh()
    },
    [refresh],
  )

  const setStatus = useCallback(
    async (pollId: string, status: MeetingPollStatus) => {
      await setMeetingPollStatus(pollId, status)
      await refresh()
    },
    [refresh],
  )

  return {
    polls,
    loading,
    error,
    refresh,
    createPoll,
    vote,
    setStatus,
  }
}
