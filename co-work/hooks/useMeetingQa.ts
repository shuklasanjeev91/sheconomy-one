import { useCallback, useEffect, useState } from 'react'

import {
  askMeetingQuestion,
  fetchMeetingQuestions,
  setMeetingQuestionPinned,
  upvoteMeetingQuestion,
  updateMeetingQuestionStatus,
  type MeetingQuestion,
  type MeetingQuestionStatus,
} from '~/co-work/lib/meeting-qna'

type UseMeetingQaOptions = {
  meetingId: string
  userId: string
  enabled?: boolean
}

export function useMeetingQa({ meetingId, userId, enabled = true }: UseMeetingQaOptions) {
  const [questions, setQuestions] = useState<MeetingQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!meetingId || !userId || !enabled) return
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchMeetingQuestions(meetingId, userId)
      setQuestions(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load Q&A')
    } finally {
      setLoading(false)
    }
  }, [enabled, meetingId, userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const askQuestion = useCallback(
    async (body: string, anonymous?: boolean) => {
      await askMeetingQuestion({ meetingId, askerId: userId, body, anonymous })
      await refresh()
    },
    [meetingId, refresh, userId],
  )

  const upvote = useCallback(
    async (questionId: string) => {
      await upvoteMeetingQuestion(questionId)
      await refresh()
    },
    [refresh],
  )

  const setQuestionStatus = useCallback(
    async (questionId: string, status: MeetingQuestionStatus) => {
      await updateMeetingQuestionStatus(
        questionId,
        status,
        status === 'answered' ? userId : null,
      )
      await refresh()
    },
    [refresh, userId],
  )

  const setPinned = useCallback(
    async (questionId: string, pinned: boolean) => {
      await setMeetingQuestionPinned(questionId, pinned)
      await refresh()
    },
    [refresh],
  )

  return {
    questions,
    loading,
    error,
    refresh,
    askQuestion,
    upvote,
    setQuestionStatus,
    setPinned,
  }
}
