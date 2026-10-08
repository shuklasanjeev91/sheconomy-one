import { useEffect } from 'react'

import { consumePendingMeetingJoin } from '~/co-work/lib/pending-meeting-join'
import { openAppPath } from '~/lib/platform/linking'

const RESUME_DELAY_MS = 450

export function PendingMeetingJoinResume() {
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      void consumePendingMeetingJoin().then((pending) => {
        if (cancelled || !pending) return
        void openAppPath(pending.path)
      })
    }, RESUME_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  return null
}
