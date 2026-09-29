import { useCallback, useMemo, useState } from 'react'

import { useMeetingLiveSignals } from '~/co-work/components/MeetingLiveSignalsContext'
import { useMeetingMachine } from '~/co-work/components/MeetingProvider'
import {
  meetingStagePageIndex,
  meetingStagePages,
  meetingStageSwipeTarget,
  type MeetingStagePage,
  type MeetingStageSwipeDirection,
} from '~/co-work/lib/meeting-stage-pager'

/** Zoom-mobile swipe pages for the meeting stage (web + native). */
export function useMeetingStagePager(input: {
  cameraTiles: number
  pageSize: number
  hasScreenShare: boolean
}) {
  const { cameraTiles, pageSize, hasScreenShare } = input
  const { state, dispatch } = useMeetingMachine()
  const { safeDrivingAvailable, openSafeDriving } = useMeetingLiveSignals()
  const [requestedGalleryPage, setRequestedGalleryPage] = useState(0)

  const pages = useMemo(
    () =>
      meetingStagePages({
        participantTiles: cameraTiles,
        pageSize,
        hasScreenShare,
        safeDriving: safeDrivingAvailable,
      }),
    [cameraTiles, hasScreenShare, pageSize, safeDrivingAvailable],
  )
  const galleryPageCount = pages.filter((page) => page.kind === 'gallery').length
  const galleryPage = Math.min(requestedGalleryPage, Math.max(0, galleryPageCount - 1))
  const index = meetingStagePageIndex(pages, {
    viewMode: state.viewMode,
    galleryPage,
    hasScreenShare,
  })

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
          setRequestedGalleryPage(page.page)
          dispatch({ type: 'SET_VIEW', viewMode: 'gallery' })
      }
    },
    [dispatch, openSafeDriving],
  )

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
    galleryPage,
    canGoNext: index < pages.length - 1,
    canGoPrev: index > 0,
    goTo,
    swipe,
  }
}
