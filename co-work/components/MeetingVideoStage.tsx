import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useWindowDimensions } from 'react-native'

import { TrackLoop, useRoomContext } from '@livekit/components-react'
import { isTrackReference } from '@livekit/components-core'

import { useMeetingGalleryTracks } from '~/co-work/hooks/useMeetingGalleryTracks'
import {
  meetingFilmstripWindow,
  meetingGalleryLayout,
  meetingGalleryScrollLayout,
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
import {
  applyMeetingSelectiveCameraSubscribe,
  meetingCameraQualityForTile,
} from '~/co-work/lib/meeting-selective-subscribe'
import { useAppLayout } from '~/hooks/useAppLayout'
import { useMeetingMachine } from '~/co-work/components/MeetingProvider'

import { SheconomyParticipantTile } from '~/co-work/components/SheconomyParticipantTile'
import { useMeetingLiveSignals } from '~/co-work/components/MeetingLiveSignalsContext'
import { screenShareRoleLabel } from '~/co-work/lib/meeting-lifecycle'
import {
  MEETING_FLOATING_DRAG_SLOP,
  MEETING_FLOATING_MARGIN,
  meetingFloatingCornerForPoint,
  meetingFloatingTileSize,
  type MeetingFloatingCorner,
} from '~/co-work/lib/meeting-floating-tile'

/** Filmstrip tile length along the scroll axis, including the 8px flex gap (see livekit web CSS). */
const FILMSTRIP_ITEM_SIZE_BOTTOM = 132 + 8
const FILMSTRIP_ITEM_SIZE_BESIDE = 110 + 8
const FILMSTRIP_GAP = 8
/** Header row + 4px padding + gap ahead of the first filmstrip tile. */
const FILMSTRIP_HEADER_SIZE_BESIDE = 30 + 4 + 8
const FILMSTRIP_HEADER_SIZE_BOTTOM = 36 + 4 + 8
/** Matches `.sheconomy-video-gallery` gap in the LiveKit web CSS. */
const GALLERY_GAP = 10
const GALLERY_MIN_ROW_HEIGHT = 96
/** Clicks here are controls of their own, not a tap-to-toggle on the stage. */
const STAGE_TAP_IGNORE_SELECTOR =
  'button, a, input, [role="menu"], .sheconomy-video-filmstrip__header, .sheconomy-video-pip'

/** Scroll offset + viewport of an overflow container, measured once per frame. */
function useScrollMetrics(vertical: boolean, active: boolean) {
  const ref = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<number | null>(null)
  const [metrics, setMetrics] = useState({ offset: 0, viewport: 0 })
  const measure = useCallback(() => {
    if (frameRef.current != null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const node = ref.current
      if (!node) return
      const next = vertical
        ? { offset: node.scrollTop, viewport: node.clientHeight }
        : { offset: node.scrollLeft, viewport: node.clientWidth }
      setMetrics((prev) =>
        prev.offset === next.offset && prev.viewport === next.viewport ? prev : next,
      )
    })
  }, [vertical])
  useEffect(
    () => () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    },
    [],
  )
  useEffect(() => {
    const node = ref.current
    if (!active || !node) {
      setMetrics((prev) => (prev.offset === 0 && prev.viewport === 0 ? prev : { offset: 0, viewport: 0 }))
      return
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure())
    observer.observe(node)
    return () => observer.disconnect()
  }, [active, measure])
  return { ref, measure, metrics }
}

/** SHEconomy-branded video gallery — web LiveKit stage (native uses NativeLiveKitMeetingRoom). */
export function MeetingVideoStage() {
  const { isDesktop, isTablet, safeTop, safeBottom, safeLeft, safeRight } = useAppLayout()
  const { state, dispatch } = useMeetingMachine()
  const { stageTrailingInset, setStageHandlesTaps, triggerStageTap } = useMeetingLiveSignals()
  useEffect(() => {
    setStageHandlesTaps(true)
    return () => setStageHandlesTaps(false)
  }, [setStageHandlesTaps])
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
  const { stageTracks, filmstripTracks, pipTrack, totalTiles, hasScreenShare, isLocalScreenSharing } =
    useMeetingGalleryTracks()
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [pipSwapped, setPipSwapped] = useState(false)
  const [pipCorner, setPipCorner] = useState<MeetingFloatingCorner>('bottom-right')
  const [pipDragOffset, setPipDragOffset] = useState<{ x: number; y: number } | null>(null)
  const pipPointerRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    moved: boolean
  } | null>(null)
  useEffect(() => {
    if (!pipTrack) setPipSwapped(false)
  }, [pipTrack])
  const mainStageTracks = useMemo(
    () => (pipTrack && pipSwapped ? [pipTrack] : stageTracks),
    [pipSwapped, pipTrack, stageTracks],
  )
  const floatingTracks = useMemo(() => {
    if (!pipTrack) return []
    const floating = pipSwapped ? stageTracks[0] : pipTrack
    return floating ? [floating] : []
  }, [pipSwapped, pipTrack, stageTracks])
  const [filmstripWidth, setFilmstripWidth] = useState(uiLayout.filmstripWidth)
  const [filmstripOffset, setFilmstripOffset] = useState({ x: 0, y: 0 })
  const [screenShareBannerVisible, setScreenShareBannerVisible] = useState(false)
  const previousScreenShare = useRef(false)
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
  const galleryModeEarly = !screenLayoutEarly && !speakerLayoutEarly
  const galleryScrollMetrics = useScrollMetrics(
    true,
    galleryModeEarly && stageTracks.length > pageSize,
  )
  const galleryScroll = meetingGalleryScrollLayout(stageTracks.length, {
    width: stageWidth,
    height: galleryScrollMetrics.metrics.viewport || stageHeight,
    preferWide: uiLayout.galleryPreferWide,
    screenSize: pageSize,
    gap: GALLERY_GAP,
    minRowHeight: GALLERY_MIN_ROW_HEIGHT,
  })
  const galleryScrolls = galleryModeEarly && galleryScroll.scrolls
  const galleryRowSize = galleryScroll.rowHeight + GALLERY_GAP
  const galleryRowWindow = meetingFilmstripWindow({
    total: galleryScroll.rows,
    itemSize: galleryRowSize,
    scrollOffset: galleryScrollMetrics.metrics.offset,
    viewportSize: galleryScrollMetrics.metrics.viewport,
    overscan: 1,
    initialCount: galleryScroll.visibleRows + 1,
  })
  const galleryVisible = useMemo(
    () =>
      galleryScrolls
        ? stageTracks.slice(
            galleryRowWindow.start * galleryScroll.columns,
            galleryRowWindow.end * galleryScroll.columns,
          )
        : stageTracks,
    [galleryRowWindow.end, galleryRowWindow.start, galleryScroll.columns, galleryScrolls, stageTracks],
  )
  const galleryLeadSpace = galleryRowWindow.start * galleryRowSize
  const galleryTrailSpace = Math.max(0, (galleryScroll.rows - galleryRowWindow.end) * galleryRowSize)
  const galleryHiddenBelow = galleryScrolls
    ? Math.max(
        0,
        stageTracks.length -
          Math.ceil(
            (galleryScrollMetrics.metrics.offset +
              (galleryScrollMetrics.metrics.viewport || stageHeight)) /
              galleryRowSize,
          ) *
            galleryScroll.columns,
      )
    : 0

  const filmstripMounted = filmstripTracks.length > 0 && !state.participantStripMinimized
  const filmstripScroll = useScrollMetrics(filmstripBesideEarly, filmstripMounted)
  const filmstripRef = filmstripScroll.ref
  const filmstripItemSize = filmstripBesideEarly
    ? FILMSTRIP_ITEM_SIZE_BESIDE
    : FILMSTRIP_ITEM_SIZE_BOTTOM
  const filmstripWindow = meetingFilmstripWindow({
    total: filmstripTracks.length,
    itemSize: filmstripItemSize,
    scrollOffset: filmstripScroll.metrics.offset,
    viewportSize: filmstripScroll.metrics.viewport,
    leadingOffset: filmstripBesideEarly
      ? FILMSTRIP_HEADER_SIZE_BESIDE
      : FILMSTRIP_HEADER_SIZE_BOTTOM,
  })
  const filmstripVisible = useMemo(
    () => filmstripTracks.slice(filmstripWindow.start, filmstripWindow.end),
    [filmstripTracks, filmstripWindow.end, filmstripWindow.start],
  )
  const filmstripLeadSpace = Math.max(filmstripWindow.start * filmstripItemSize - FILMSTRIP_GAP, 0)
  const filmstripTrailSpace = Math.max(
    (filmstripTracks.length - filmstripWindow.end) * filmstripItemSize - FILMSTRIP_GAP,
    0,
  )

  useEffect(() => {
    const identities = new Set<string>()
    for (const track of galleryVisible) identities.add(track.participant.identity)
    for (const track of filmstripVisible) identities.add(track.participant.identity)
    // Always include anyone actively speaking even if scrolled out of view.
    for (const track of stageTracks) {
      if (isTrackReference(track) && track.participant.isSpeaking) {
        identities.add(track.participant.identity)
      }
    }
    applyMeetingSelectiveCameraSubscribe(room, identities)
  }, [filmstripVisible, galleryVisible, room, stageTracks])

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
  }, [filmstripRef, uiLayout.filmstripBeside, uiLayout.policy, state.participantStripMinimized])

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
      meetingGalleryLayout(stageTracks.length, {
        width: stageWidth,
        height: stageHeight,
        preferWide: uiLayout.galleryPreferWide,
      }),
    [uiLayout.galleryPreferWide, stageTracks.length, stageWidth, stageHeight],
  )
  const screenLayout = screenLayoutEarly
  const speakerLayout = speakerLayoutEarly
  const galleryMode = galleryModeEarly
  const solo = galleryMode && stageTracks.length <= 1
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
  const scrollTileQuality = meetingCameraQualityForTile({
    width: (stageWidth - GALLERY_GAP * (galleryScroll.columns - 1)) / galleryScroll.columns,
    height: galleryScroll.rowHeight,
    hdVideo: hdVideoPref,
  })
  const stageTileQuality = meetingCameraQualityForTile({
    width: (stageWidth - GALLERY_GAP * (galleryCols - 1)) / galleryCols,
    height: (stageHeight - GALLERY_GAP * (galleryRows - 1)) / galleryRows,
    hdVideo: hdVideoPref,
  })
  const filmstripTileQuality = meetingCameraQualityForTile({
    width: filmstripBeside ? speakerFilmstripWidth : 132,
    height: filmstripBeside ? 110 : 84,
    hdVideo: hdVideoPref,
  })
  const { width: pipWidth, height: pipHeight } = meetingFloatingTileSize({
    width: stageWidth,
    height: stageHeight,
  })
  const pipTileQuality = meetingCameraQualityForTile({
    width: pipWidth,
    height: pipHeight,
    hdVideo: hdVideoPref,
  })
  const pipTop = pipCorner.startsWith('top')
  const pipLeft = pipCorner.endsWith('left')

  function finishPipPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const pointer = pipPointerRef.current
    if (!pointer || pointer.pointerId !== event.pointerId) return
    pipPointerRef.current = null
    setPipDragOffset(null)
    if (!pointer.moved) {
      setPipSwapped((swapped) => !swapped)
      return
    }
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    setPipCorner(
      meetingFloatingCornerForPoint(
        { x: event.clientX - rect.left, y: event.clientY - rect.top },
        rect,
      ),
    )
  }

  return (
    <div
      ref={stageRef}
      className={stageClassName}
      onClick={(event) => {
        const target = event.target as HTMLElement | null
        if (target?.closest?.(STAGE_TAP_IGNORE_SELECTOR)) return
        triggerStageTap()
      }}
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
      {galleryScrolls ? (
        <div
          ref={galleryScrollMetrics.ref}
          className="sheconomy-video-gallery sheconomy-video-gallery--scroll"
          onScroll={galleryScrollMetrics.measure}
        >
          <div
            className="sheconomy-video-gallery__rows"
            style={{
              gridTemplateColumns: `repeat(${galleryScroll.columns}, minmax(0, 1fr))`,
              gridAutoRows: `${galleryScroll.rowHeight}px`,
              paddingTop: galleryLeadSpace,
              paddingBottom: galleryTrailSpace,
            }}
          >
            <TrackLoop tracks={galleryVisible}>
              <SheconomyParticipantTile
                mirrorLocalVideo={state.mirrorLocalVideo}
                cameraQuality={scrollTileQuality}
              />
            </TrackLoop>
          </div>
        </div>
      ) : (
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
          <TrackLoop tracks={mainStageTracks}>
            <SheconomyParticipantTile
              mirrorLocalVideo={state.mirrorLocalVideo}
              cameraQuality={stageTileQuality}
            />
          </TrackLoop>
        </div>
      )}

      {floatingTracks.length > 0 ? (
        <div
          className="sheconomy-video-pip"
          role="button"
          aria-label={pipSwapped ? 'Show the other participant full screen' : 'Show yourself full screen'}
          style={{
            width: pipWidth,
            height: pipHeight,
            aspectRatio: 'auto',
            top: pipTop ? uiLayout.stagePaddingTop + MEETING_FLOATING_MARGIN : 'auto',
            bottom: pipTop ? 'auto' : uiLayout.stagePaddingBottom + MEETING_FLOATING_MARGIN,
            left: pipLeft ? uiLayout.stagePaddingLeft + MEETING_FLOATING_MARGIN : 'auto',
            right: pipLeft
              ? 'auto'
              : uiLayout.stagePaddingRight + stageTrailingInset + MEETING_FLOATING_MARGIN,
            transform: pipDragOffset
              ? `translate(${pipDragOffset.x}px, ${pipDragOffset.y}px)`
              : undefined,
            transition: pipDragOffset ? 'none' : 'top 0.2s, bottom 0.2s, left 0.2s, right 0.2s',
            touchAction: 'none',
            cursor: pipDragOffset ? 'grabbing' : 'grab',
          }}
          onPointerDown={(event) => {
            if ((event.target as HTMLElement | null)?.closest?.('button, a, [role="menu"]')) return
            pipPointerRef.current = {
              pointerId: event.pointerId,
              startX: event.clientX,
              startY: event.clientY,
              moved: false,
            }
            event.currentTarget.setPointerCapture?.(event.pointerId)
          }}
          onPointerMove={(event) => {
            const pointer = pipPointerRef.current
            if (!pointer || pointer.pointerId !== event.pointerId) return
            const x = event.clientX - pointer.startX
            const y = event.clientY - pointer.startY
            if (!pointer.moved && Math.hypot(x, y) < MEETING_FLOATING_DRAG_SLOP) return
            pointer.moved = true
            setPipDragOffset({ x, y })
          }}
          onPointerUp={finishPipPointer}
          onPointerCancel={finishPipPointer}
        >
          <TrackLoop tracks={floatingTracks}>
            <SheconomyParticipantTile
              mirrorLocalVideo={state.mirrorLocalVideo}
              cameraQuality={pipTileQuality}
            />
          </TrackLoop>
        </div>
      ) : null}

      {filmstripTracks.length > 0 ? (
        <div
          ref={filmstripRef}
          className={`sheconomy-video-filmstrip${
            state.participantStripMinimized ? ' sheconomy-video-filmstrip--minimized' : ''
          }`}
          style={{
            transform: `translate(${filmstripOffset.x}px, ${filmstripOffset.y}px)`,
          }}
          onScroll={filmstripScroll.measure}
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
              {filmstripLeadSpace > 0 ? (
                <div
                  aria-hidden
                  className="sheconomy-video-filmstrip__spacer"
                  style={{ flex: `0 0 ${filmstripLeadSpace}px` }}
                />
              ) : null}
              <TrackLoop tracks={filmstripVisible}>
                <SheconomyParticipantTile
                  mirrorLocalVideo={state.mirrorLocalVideo}
                  cameraQuality={filmstripTileQuality}
                />
              </TrackLoop>
              {filmstripTrailSpace > 0 ? (
                <div
                  aria-hidden
                  className="sheconomy-video-filmstrip__spacer"
                  style={{ flex: `0 0 ${filmstripTrailSpace}px` }}
                />
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {galleryHiddenBelow > 0 ? (
        <div className="sheconomy-gallery-more" aria-live="polite">
          ↓ {galleryHiddenBelow} more · {totalTiles} people
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
