import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useWindowDimensions } from 'react-native'

import { TrackLoop, useRoomContext } from '@livekit/components-react'
import { isTrackReference } from '@livekit/components-core'

import { useMeetingGalleryTracks } from '~/co-work/hooks/useMeetingGalleryTracks'
import {
  capFilmstripTracks,
  MEETING_GALLERY_FOLLOW_RESUME_MS,
  meetingGalleryLayout,
  meetingGalleryPageForIndex,
  meetingGalleryPrefetchIdentities,
  paginateMeetingGallery,
  resolveMeetingGalleryPageSize,
} from '~/co-work/lib/meeting-gallery-layout'
import {
  meetingStageContentBox,
  resolveMeetingUiLayout,
} from '~/co-work/lib/meeting-orientation-layout'
import {
  applyMeetingUiLayout,
  resolveMeetingUiPadding,
} from '~/co-work/lib/meeting-ui-overlay'
import { applyMeetingSelectiveCameraSubscribe } from '~/co-work/lib/meeting-selective-subscribe'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useMeetingMachine } from '~/co-work/components/MeetingProvider'

import { SheconomyParticipantTile } from '~/co-work/components/SheconomyParticipantTile'
import { useMeetingLiveSignals } from '~/co-work/components/MeetingLiveSignalsContext'
import { screenShareRoleLabel } from '~/co-work/lib/meeting-lifecycle'

/** SHEconomy-branded video gallery — web LiveKit stage (native uses NativeLiveKitMeetingRoom). */
export function MeetingVideoStage() {
  const { isDesktop, isTablet, safeTop, safeBottom, safeLeft, safeRight } = useAppLayout()
  const { state, dispatch } = useMeetingMachine()
  const { stageTrailingInset } = useMeetingLiveSignals()
  const room = useRoomContext()
  const { width, height } = useWindowDimensions()
  const [hdVideoPref, setHdVideoPref] = useState(true)
  useEffect(() => {
    void import('~/co-work/lib/meeting-media-prefs').then(({ loadMeetingMediaPrefs }) =>
      loadMeetingMediaPrefs().then((prefs) => setHdVideoPref(prefs.hdVideo !== false)),
    )
  }, [])
  const uiLayout = useMemo(() => {
    const base = resolveMeetingUiLayout({
      width,
      height,
      safeTop,
      safeBottom,
      safeLeft,
      safeRight,
      isTablet,
      isDesktop,
      isNative: false,
    })
    return applyMeetingUiLayout(
      base,
      resolveMeetingUiPadding({
        layout: base,
        uiMode: state.uiMode,
        controlsVisible: state.controlsVisible,
        safeTop,
        safeBottom,
      }),
    )
  }, [
    height,
    isDesktop,
    isTablet,
    safeBottom,
    safeLeft,
    safeRight,
    safeTop,
    state.controlsVisible,
    state.uiMode,
    width,
  ])
  const { stageTracks, filmstripTracks, totalTiles, hasScreenShare, isLocalScreenSharing } =
    useMeetingGalleryTracks()
  const [page, setPage] = useState(0)
  const [filmstripWidth, setFilmstripWidth] = useState(uiLayout.filmstripWidth)
  const [filmstripOffset, setFilmstripOffset] = useState({ x: 0, y: 0 })
  const [screenShareBannerVisible, setScreenShareBannerVisible] = useState(false)
  const previousScreenShare = useRef(false)
  const followSpeakerUntilRef = useRef(0)
  const filmstripRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const pageSize = resolveMeetingGalleryPageSize({
    basePageSize: uiLayout.pageSize,
    denseGallery: state.denseGallery,
    breakpoint: uiLayout.breakpoint,
  })
  const filmstripExpanded = filmstripTracks.length > 0 && !state.participantStripMinimized
  const screenLayoutEarly = state.viewMode === 'screen-share' && hasScreenShare
  const speakerLayoutEarly = state.viewMode === 'speaker'
  const filmstripBesideEarly =
    speakerLayoutEarly || screenLayoutEarly
      ? uiLayout.filmstripBeside || width >= 700 || state.sideBySideShare
      : uiLayout.filmstripBeside || state.sideBySideShare
  const { width: stageWidth, height: stageHeight } = meetingStageContentBox({
    viewportWidth: width,
    viewportHeight: height,
    layout: {
      ...uiLayout,
      filmstripBeside: filmstripBesideEarly,
      filmstripWidth: filmstripBesideEarly
        ? Math.max(uiLayout.filmstripWidth, speakerLayoutEarly ? 120 : uiLayout.filmstripWidth)
        : uiLayout.filmstripWidth,
      filmstripHeight:
        speakerLayoutEarly && !filmstripBesideEarly
          ? Math.max(uiLayout.filmstripHeight, 96)
          : uiLayout.filmstripHeight,
    },
    filmstripExpanded,
    stageTrailingInset,
  })
  const paged = useMemo(
    () => paginateMeetingGallery(stageTracks, page, pageSize),
    [page, pageSize, stageTracks],
  )
  const filmstripCapped = useMemo(
    () => capFilmstripTracks(filmstripTracks),
    [filmstripTracks],
  )

  useEffect(() => {
    if (paged.page !== page) setPage(paged.page)
  }, [page, paged.page])

  const goToPage = (nextPage: number) => {
    // Manual Prev/Next / dots — pause auto-follow so speaking can't yank the page back.
    followSpeakerUntilRef.current = Date.now() + MEETING_GALLERY_FOLLOW_RESUME_MS
    setPage(nextPage)
  }

  // Jump to the page holding the active speaker only while the user is not paging.
  useEffect(() => {
    if (state.viewMode !== 'gallery') return
    if (Date.now() < followSpeakerUntilRef.current) return
    const speaking = stageTracks.findIndex(
      (track) => isTrackReference(track) && track.participant.isSpeaking,
    )
    if (speaking < 0) return
    const target = meetingGalleryPageForIndex(speaking, pageSize)
    if (target !== page) setPage(target)
  }, [page, pageSize, stageTracks, state.viewMode])

  useEffect(() => {
    const identities = new Set<string>(
      meetingGalleryPrefetchIdentities(stageTracks, paged.page, pageSize),
    )
    for (const track of filmstripCapped.visible) {
      identities.add(track.participant.identity)
    }
    // Always include anyone actively speaking even if off the current page.
    for (const track of stageTracks) {
      if (isTrackReference(track) && track.participant.isSpeaking) {
        identities.add(track.participant.identity)
      }
    }
    applyMeetingSelectiveCameraSubscribe(room, identities)
  }, [filmstripCapped.visible, paged.page, pageSize, room, stageTracks])

  useEffect(() => {
    if (hasScreenShare && !previousScreenShare.current) {
      dispatch({ type: 'SET_VIEW', viewMode: 'screen-share' })
      setScreenShareBannerVisible(true)
    } else if (!hasScreenShare && state.viewMode === 'screen-share') {
      dispatch({ type: 'SET_VIEW', viewMode: 'gallery' })
      setScreenShareBannerVisible(false)
    } else if (!hasScreenShare) {
      setScreenShareBannerVisible(false)
    }
    previousScreenShare.current = hasScreenShare
  }, [dispatch, hasScreenShare, state.viewMode])

  useEffect(() => {
    if (!hasScreenShare || !screenShareBannerVisible) return
    const timer = setTimeout(() => setScreenShareBannerVisible(false), 4500)
    return () => clearTimeout(timer)
  }, [hasScreenShare, screenShareBannerVisible])

  useEffect(() => {
    setFilmstripWidth(uiLayout.filmstripWidth)
  }, [uiLayout.filmstripWidth])

  useEffect(() => {
    if (
      !uiLayout.filmstripBeside ||
      uiLayout.policy === 'landscape-phone' ||
      state.participantStripMinimized ||
      !filmstripRef.current ||
      typeof ResizeObserver === 'undefined'
    )
      return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setFilmstripWidth(Math.max(144, Math.min(360, Math.round(entry.contentRect.width))))
    })
    observer.observe(filmstripRef.current)
    return () => observer.disconnect()
  }, [uiLayout.filmstripBeside, uiLayout.policy, state.participantStripMinimized])

  useEffect(() => {
    if (!isDesktop) {
      setFilmstripOffset({ x: 0, y: 0 })
      dragRef.current = null
      return
    }
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || event.pointerId !== drag.pointerId) return
      setFilmstripOffset({
        x: Math.max(
          -Math.max(stageWidth - filmstripWidth - 24, 0),
          Math.min(0, drag.originX + event.clientX - drag.startX),
        ),
        y: Math.max(0, Math.min(stageHeight - 180, drag.originY + event.clientY - drag.startY)),
      })
    }
    const stopDragging = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }
  }, [filmstripWidth, isDesktop, stageHeight, stageWidth])

  const galleryLayout = useMemo(
    () =>
      meetingGalleryLayout(paged.items.length, {
        width: stageWidth,
        height: stageHeight,
        preferWide: uiLayout.galleryPreferWide,
      }),
    [uiLayout.galleryPreferWide, paged.items.length, stageWidth, stageHeight],
  )
  const screenLayout = screenLayoutEarly
  const speakerLayout = speakerLayoutEarly
  const galleryMode = state.viewMode === 'gallery' || (!screenLayout && !speakerLayout)
  const solo = galleryMode && paged.items.length <= 1
  const filmstripBeside = filmstripBesideEarly
  const galleryClass = screenLayout
    ? 'sheconomy-video-gallery sheconomy-video-gallery--screen'
    : speakerLayout
      ? 'sheconomy-video-gallery sheconomy-video-gallery--speaker'
      : solo
        ? 'sheconomy-video-gallery sheconomy-video-gallery--solo'
        : 'sheconomy-video-gallery sheconomy-video-gallery--grid'

  const stageClassName = [
    'sheconomy-video-stage',
    filmstripTracks.length > 0 ? 'sheconomy-video-stage--filmstrip' : '',
    filmstripTracks.length > 0 && state.participantStripMinimized
      ? 'sheconomy-video-stage--filmstrip-minimized'
      : '',
    speakerLayout ? 'sheconomy-video-stage--speaker' : '',
    filmstripBeside ? 'sheconomy-video-stage--filmstrip-beside' : 'sheconomy-video-stage--filmstrip-bottom',
    uiLayout.policy === 'landscape-phone' ? 'sheconomy-video-stage--landscape-phone' : '',
    uiLayout.policy === 'portrait-phone' ? 'sheconomy-video-stage--portrait-phone' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const galleryCols = screenLayout || speakerLayout ? 1 : galleryLayout.columns
  const galleryRows = screenLayout || speakerLayout ? 1 : galleryLayout.rows
  const speakerFilmstripWidth = Math.max(
    filmstripBeside ? filmstripWidth : uiLayout.filmstripWidth,
    speakerLayout ? 120 : 0,
  )


  return (
    <div
      className={stageClassName}
      style={
        {
          '--filmstrip-width': state.participantStripMinimized
            ? '44px'
            : `${filmstripBeside ? speakerFilmstripWidth : uiLayout.filmstripWidth}px`,
          '--stage-pad-top': `${uiLayout.stagePaddingTop}px`,
          '--stage-pad-bottom': `${uiLayout.stagePaddingBottom}px`,
          '--stage-pad-left': `${uiLayout.stagePaddingLeft}px`,
          '--stage-pad-right': `${uiLayout.stagePaddingRight}px`,
          '--filmstrip-height': `${speakerLayout && !filmstripBeside ? Math.max(uiLayout.filmstripHeight, 96) : uiLayout.filmstripHeight}px`,
          paddingTop: uiLayout.stagePaddingTop,
          paddingBottom: uiLayout.stagePaddingBottom,
          paddingLeft: uiLayout.stagePaddingLeft,
          paddingRight: uiLayout.stagePaddingRight + stageTrailingInset,
          boxSizing: 'border-box',
        } as CSSProperties
      }
    >
      <div
        className={galleryClass}
        style={
          {
            '--gallery-cols': String(galleryCols),
            '--gallery-rows': String(galleryRows),
            // Apply grid template directly — CSS vars alone are flaky in some WebViews.
            gridTemplateColumns:
              screenLayout || speakerLayout || solo
                ? undefined
                : `repeat(${galleryCols}, minmax(0, 1fr))`,
            gridTemplateRows:
              screenLayout || speakerLayout || solo
                ? undefined
                : `repeat(${galleryRows}, minmax(0, 1fr))`,
            display: screenLayout || speakerLayout || solo ? undefined : 'grid',
          } as CSSProperties
        }
      >
        <TrackLoop tracks={paged.items}>
          <SheconomyParticipantTile mirrorLocalVideo={state.mirrorLocalVideo} hdVideo={hdVideoPref} />
        </TrackLoop>
      </div>

      {filmstripTracks.length > 0 ? (
        <div
          ref={filmstripRef}
          className={`sheconomy-video-filmstrip${
            state.participantStripMinimized ? ' sheconomy-video-filmstrip--minimized' : ''
          }`}
          style={{
            transform: `translate(${filmstripOffset.x}px, ${filmstripOffset.y}px)`,
          }}
        >
          <div
            className="sheconomy-video-filmstrip__header"
            onPointerDown={(event) => {
              if (!isDesktop || !filmstripBeside || state.participantStripMinimized) return
              dragRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                originX: filmstripOffset.x,
                originY: filmstripOffset.y,
              }
              event.currentTarget.setPointerCapture?.(event.pointerId)
            }}
          >
            {!state.participantStripMinimized ? (
              <span>{speakerLayout ? 'Others' : 'Participants'}</span>
            ) : null}
            <button
              type="button"
              aria-label={
                state.participantStripMinimized
                  ? 'Maximize participant filmstrip'
                  : 'Minimize participant filmstrip'
              }
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => dispatch({ type: 'TOGGLE_PARTICIPANT_STRIP' })}
            >
              {state.participantStripMinimized ? '›' : '−'}
            </button>
          </div>
          {!state.participantStripMinimized ? (
            <>
              <TrackLoop tracks={filmstripCapped.visible}>
                <SheconomyParticipantTile mirrorLocalVideo={state.mirrorLocalVideo} hdVideo={hdVideoPref} />
              </TrackLoop>
              {filmstripCapped.overflow > 0 ? (
                <div className="sheconomy-video-filmstrip__overflow" aria-label="More participants">
                  +{filmstripCapped.overflow}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {paged.pageCount > 1 ? (
        <div className="sheconomy-gallery-pagination" role="navigation" aria-label="Gallery pages">
          <button
            type="button"
            disabled={paged.page === 0}
            onClick={() => goToPage(paged.page - 1)}
          >
            ‹ Prev
          </button>
          <div className="sheconomy-gallery-pagination__dots" aria-hidden>
            {Array.from({ length: Math.min(paged.pageCount, 8) }).map((_, dot) => {
              const pageIndex =
                paged.pageCount <= 8
                  ? dot
                  : Math.min(Math.max(0, paged.page - 3) + dot, paged.pageCount - 1)
              const active = pageIndex === paged.page
              return (
                <button
                  key={`web-dot-${pageIndex}-${dot}`}
                  type="button"
                  className={
                    active
                      ? 'sheconomy-gallery-pagination__dot sheconomy-gallery-pagination__dot--active'
                      : 'sheconomy-gallery-pagination__dot'
                  }
                  onClick={() => goToPage(pageIndex)}
                  aria-label={`Gallery page ${pageIndex + 1}`}
                />
              )
            })}
          </div>
          <span>
            {paged.page + 1} / {paged.pageCount}
            {totalTiles > 0 ? ` · ${totalTiles} people` : ''}
          </span>
          <button
            type="button"
            disabled={paged.page === paged.pageCount - 1}
            onClick={() => goToPage(paged.page + 1)}
          >
            Next ›
          </button>
        </div>
      ) : null}

      {totalTiles === 0 ? <div className="sheconomy-video-empty" /> : null}
      {(() => {
        if (!screenShareBannerVisible) return null
        const role = isLocalScreenSharing ? 'sharing' : hasScreenShare ? 'viewing' : 'none'
        const label = screenShareRoleLabel(role)
        return label ? (
          <div
            className={
              role === 'viewing'
                ? 'sheconomy-screen-share-status sheconomy-screen-share-status--viewing'
                : 'sheconomy-screen-share-status'
            }
            role="status"
          >
            {label}
          </div>
        ) : null
      })()}
    </div>
  )
}
