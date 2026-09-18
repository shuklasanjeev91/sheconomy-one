import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useWindowDimensions } from 'react-native'

import { TrackLoop, useRoomContext } from '@livekit/components-react'
import { isTrackReference } from '@livekit/components-core'

import { useMeetingGalleryTracks } from '~/co-work/hooks/useMeetingGalleryTracks'
import {
  capFilmstripTracks,
  meetingGalleryLayout,
  paginateMeetingGallery,
  resolveMeetingGalleryPageSize,
} from '~/co-work/lib/meeting-gallery-layout'
import {
  meetingStageContentBox,
  resolveMeetingChromeLayout,
} from '~/co-work/lib/meeting-orientation-layout'
import {
  applyMeetingUiChromeLayout,
  resolveMeetingUiChromePadding,
} from '~/co-work/lib/meeting-ui-chrome'
import { applyMeetingSelectiveCameraSubscribe } from '~/co-work/lib/meeting-selective-subscribe'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useMeetingMachine } from '~/co-work/components/MeetingProvider'

import { SheconomyParticipantTile } from '~/co-work/components/SheconomyParticipantTile'
import { screenShareRoleLabel } from '~/co-work/lib/meeting-lifecycle'

/** SHEconomy-branded video gallery — web LiveKit stage (native uses NativeLiveKitMeetingRoom). */
export function MeetingVideoStage() {
  const { isDesktop, isTablet, safeTop, safeBottom, safeLeft, safeRight } = useAppLayout()
  const { state, dispatch } = useMeetingMachine()
  const room = useRoomContext()
  const { width, height } = useWindowDimensions()
  const chrome = useMemo(() => {
    const base = resolveMeetingChromeLayout({
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
    return applyMeetingUiChromeLayout(
      base,
      resolveMeetingUiChromePadding({
        chrome: base,
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
  const [filmstripWidth, setFilmstripWidth] = useState(chrome.filmstripWidth)
  const [filmstripOffset, setFilmstripOffset] = useState({ x: 0, y: 0 })
  const previousScreenShare = useRef(false)
  const filmstripRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const pageSize = resolveMeetingGalleryPageSize({
    basePageSize: chrome.pageSize,
    denseGallery: state.denseGallery,
    breakpoint: chrome.breakpoint,
  })
  const filmstripExpanded = filmstripTracks.length > 0 && !state.participantStripMinimized
  const screenLayoutEarly = state.viewMode === 'screen-share' && hasScreenShare
  const speakerLayoutEarly = state.viewMode === 'speaker'
  const filmstripBesideEarly =
    speakerLayoutEarly || screenLayoutEarly
      ? chrome.filmstripBeside || width >= 700
      : chrome.filmstripBeside
  const { width: stageWidth, height: stageHeight } = meetingStageContentBox({
    viewportWidth: width,
    viewportHeight: height,
    chrome: {
      ...chrome,
      filmstripBeside: filmstripBesideEarly,
      filmstripWidth: filmstripBesideEarly
        ? Math.max(chrome.filmstripWidth, speakerLayoutEarly ? 120 : chrome.filmstripWidth)
        : chrome.filmstripWidth,
      filmstripHeight:
        speakerLayoutEarly && !filmstripBesideEarly
          ? Math.max(chrome.filmstripHeight, 96)
          : chrome.filmstripHeight,
    },
    filmstripExpanded,
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

  useEffect(() => {
    const identities = new Set<string>()
    for (const track of paged.items) {
      identities.add(track.participant.identity)
    }
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
  }, [filmstripCapped.visible, paged.items, room, stageTracks])

  useEffect(() => {
    if (hasScreenShare && !previousScreenShare.current) {
      dispatch({ type: 'SET_VIEW', viewMode: 'screen-share' })
    } else if (!hasScreenShare && state.viewMode === 'screen-share') {
      dispatch({ type: 'SET_VIEW', viewMode: 'gallery' })
    }
    previousScreenShare.current = hasScreenShare
  }, [dispatch, hasScreenShare, state.viewMode])

  useEffect(() => {
    setFilmstripWidth(chrome.filmstripWidth)
  }, [chrome.filmstripWidth])

  useEffect(() => {
    if (
      !chrome.filmstripBeside ||
      chrome.policy === 'landscape-phone' ||
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
  }, [chrome.filmstripBeside, chrome.policy, state.participantStripMinimized])

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

  const layout = useMemo(
    () =>
      meetingGalleryLayout(paged.items.length, {
        width: stageWidth,
        height: stageHeight,
        preferWide: chrome.galleryPreferWide,
      }),
    [chrome.galleryPreferWide, paged.items.length, stageWidth, stageHeight],
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
    chrome.policy === 'landscape-phone' ? 'sheconomy-video-stage--landscape-phone' : '',
    chrome.policy === 'portrait-phone' ? 'sheconomy-video-stage--portrait-phone' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const galleryCols = screenLayout || speakerLayout ? 1 : layout.columns
  const galleryRows = screenLayout || speakerLayout ? 1 : layout.rows
  const speakerFilmstripWidth = Math.max(
    filmstripBeside ? filmstripWidth : chrome.filmstripWidth,
    speakerLayout ? 120 : 0,
  )


  return (
    <div
      className={stageClassName}
      style={
        {
          '--filmstrip-width': state.participantStripMinimized
            ? '44px'
            : `${filmstripBeside ? speakerFilmstripWidth : chrome.filmstripWidth}px`,
          '--stage-pad-top': `${chrome.stagePaddingTop}px`,
          '--stage-pad-bottom': `${chrome.stagePaddingBottom}px`,
          '--stage-pad-left': `${chrome.stagePaddingLeft}px`,
          '--stage-pad-right': `${chrome.stagePaddingRight}px`,
          '--filmstrip-height': `${speakerLayout && !filmstripBeside ? Math.max(chrome.filmstripHeight, 96) : chrome.filmstripHeight}px`,
          paddingTop: chrome.stagePaddingTop,
          paddingBottom: chrome.stagePaddingBottom,
          paddingLeft: chrome.stagePaddingLeft,
          paddingRight: chrome.stagePaddingRight,
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
          <SheconomyParticipantTile mirrorLocalVideo={state.mirrorLocalVideo} />
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
                <SheconomyParticipantTile mirrorLocalVideo={state.mirrorLocalVideo} />
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
        <div className="sheconomy-gallery-pagination">
          <button disabled={paged.page === 0} onClick={() => setPage((value) => value - 1)}>
            Previous
          </button>
          <span>{paged.page + 1} / {paged.pageCount}</span>
          <button
            disabled={paged.page === paged.pageCount - 1}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      ) : null}

      {totalTiles === 0 ? <div className="sheconomy-video-empty" /> : null}
      {(() => {
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
