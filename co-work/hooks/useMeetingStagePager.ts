import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useMeetingLiveSignals } from '~/co-work/components/MeetingLiveSignalsContext'
import { useMeetingMachine } from '~/co-work/components/MeetingProvider'
import {
  meetingStageMainPage,
  meetingStagePageIndex,
  meetingStagePages,
  meetingStageShouldReturnToSpeaker,
  meetingStageSwipeTarget,
  type MeetingStagePage,
  type MeetingStageSwipeDirection,
} from '~/co-work/lib/meeting-stage-pager'

/** Zoom-mobile swipe pages for the meeting stage (web + native). */
export function useMeetingStagePager(input: { cameraTiles: number; hasScreenShare: boolean }) {
  const { cameraTiles, hasScreenShare } = input
  const { state, dispatch } = useMeetingMachine()
  const { safeDrivingAvailable, openSafeDriving } = useMeetingLiveSignals()

  const pages = useMemo(
    () =>
      meetingStagePages({
        participantTiles: cameraTiles,
        hasScreenShare,
        safeDriving: safeDrivingAvailable,
      }),
    [cameraTiles, hasScreenShare, safeDrivingAvailable],
  )
  const index = meetingStagePageIndex(pages, { viewMode: state.viewMode })

  const goTo = useCallback(
    (page: MeetingStagePage) => {
      switch (page.kind) {
        case 'safe-driving':
          openSafeDriving()
          return
        case 'screen-share':
          dispatch({ type: 'SET_VIEW', viewMode: 'screen-share' })
          return
        case 'speaker':
          dispatch({ type: 'SET_VIEW', viewMode: 'speaker' })
          return
        case 'gallery':
          dispatch({ type: 'SET_VIEW', viewMode: 'gallery' })
      }
    },
    [dispatch, openSafeDriving],
  )

  const previousTilesRef = useRef(cameraTiles)
  useEffect(() => {
    const previousTiles = previousTilesRef.current
    previousTilesRef.current = cameraTiles
    if (
      meetingStageShouldReturnToSpeaker({
        previousTiles,
        participantTiles: cameraTiles,
        viewMode: state.viewMode,
      })
    ) {
      goTo(meetingStageMainPage(hasScreenShare))
    }
  }, [cameraTiles, goTo, hasScreenShare, state.viewMode])

  const swipe = useCallback(
    (direction: MeetingStageSwipeDirection) => {
      const target = meetingStageSwipeTarget(pages, index, direction)
      if (target) goTo(target)
      return !!target
    },
    [goTo, index, pages],
  )

  return {
    pages,
    index,
    canGoNext: index < pages.length - 1,
    canGoPrev: index > 0,
    goTo,
    swipe,
  }
}
