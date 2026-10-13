import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Animated,
  FlatList,
  PanResponder,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native'

import { Text, XStack, YStack } from '~/components/ui'
import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { useMeetingLiveSignals } from '~/co-work/components/MeetingLiveSignalsContext'
import { useMeetingMachine } from '~/co-work/components/MeetingProvider'
import type { NativeStageTileProps } from '~/co-work/components/NativeVideoTileChrome'
import { useMeetingStagePager } from '~/co-work/hooks/useMeetingStagePager'
import {
  MEETING_FLOATING_DRAG_SLOP,
  meetingFloatingCornerForPoint,
  meetingFloatingCornerOrigin,
  meetingFloatingTileSize,
  type MeetingFloatingCorner,
} from '~/co-work/lib/meeting-floating-tile'
import {
  meetingGalleryScrollLayout,
  resolveMeetingGalleryPageSize,
} from '~/co-work/lib/meeting-gallery-layout'
import { screenShareRoleLabel } from '~/co-work/lib/meeting-lifecycle'
import { selfViewMirrorAllowed } from '~/co-work/lib/meeting-video-mirror'
import {
  meetingStageContentBox,
  resolveMeetingUiLayout,
} from '~/co-work/lib/meeting-orientation-layout'
import {
  meetingStageDragOffset,
  meetingStageIsHorizontalDrag,
  meetingStagePageKey,
  meetingStagePageLabel,
  meetingStageSwipeDirection,
  type MeetingStageSwipeDirection,
} from '~/co-work/lib/meeting-stage-pager'
import type { MeetingStageTrack, MeetingStageTracks } from '~/co-work/lib/meeting-stage-tracks'
import { applyMeetingUiLayout, resolveMeetingUiPadding } from '~/co-work/lib/meeting-ui-overlay'
import { participantDisplayName } from '~/co-work/lib/participant-avatar'
import { useCoWorkTheme } from '~/co-work/lib/theme'
import { useAppLayout } from '~/hooks/useAppLayout'

const STAGE_GAP = 10
const FILMSTRIP_GAP = 8
/** Filmstrip tiles subscribed before the first viewability callback fires. */
const FILMSTRIP_INITIAL_VISIBLE = 8
/** Distance the incoming page slides in from after a committed swipe. */
const STAGE_PAGE_ENTER_OFFSET = 56

const SCREEN_SHARE_SOURCE = 'screen_share'

function stageTrackKey(trackRef: { participant: { identity: string }; source: string }) {
  return `${trackRef.participant.identity}-${trackRef.source}`
}

/** Native stage layout, paging, filmstrip and floating self-view — independent of the SFU. */
export function NativeMeetingVideoStageView<T extends MeetingStageTrack>({
  layoutState,
  activeSpeakerIdentity,
  onVisibleIdentities,
  tileKey,
  renderTile,
  onStopScreenShare,
}: {
  layoutState: MeetingStageTracks<T>
  activeSpeakerIdentity: string | null
  /** Remote cameras worth receiving: visible tiles, neighbouring pages, speakers. */
  onVisibleIdentities: (identities: Set<string>) => void
  tileKey: (trackRef: T) => string
  renderTile: (props: NativeStageTileProps<T>) => ReactNode
  /** Zoom's red Stop Share on the presenter's banner. */
  onStopScreenShare?: () => void
}) {
  const { ui: coworkUi } = useCoWorkTheme()
  const { state, dispatch } = useMeetingMachine()
  const selfViewMirror = selfViewMirrorAllowed(state.mirrorLocalVideo, state.localBackgroundMode)
  const { stageTrailingInset, setStageHandlesTaps, triggerStageTap } = useMeetingLiveSignals()
  useEffect(() => {
    setStageHandlesTaps(true)
    return () => setStageHandlesTaps(false)
  }, [setStageHandlesTaps])
  const { width, height } = useWindowDimensions()
  const { isDesktop, isTablet, safeTop, safeBottom, safeLeft, safeRight } = useAppLayout()
  const [hdVideoPref, setHdVideoPref] = useState(true)
  useEffect(() => {
    void import('~/co-work/lib/meeting-media-prefs').then(({ loadMeetingMediaPrefs }) =>
      loadMeetingMediaPrefs().then((prefs) => setHdVideoPref(prefs.hdVideo !== false)),
    )
  }, [])
  const layout = useMemo(() => {
    const base = resolveMeetingUiLayout({
      width,
      height,
      safeTop,
      safeBottom,
      safeLeft,
      safeRight,
      isTablet,
      isDesktop,
      isNative: true,
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
  const [screenShareBannerVisible, setScreenShareBannerVisible] = useState(false)
  const pageSize = resolveMeetingGalleryPageSize({
    basePageSize: layout.pageSize,
    denseGallery: state.denseGallery,
    breakpoint: layout.breakpoint,
  })
  const pipTrack = layoutState.pipTrack
  const floatingTrack = pipTrack ?? undefined
  const filmstripTracks = layoutState.filmstripTracks
  // Virtualized filmstrip: only tiles scrolled into view get camera subscriptions.
  const [filmstripVisibleIds, setFilmstripVisibleIds] = useState<string[] | null>(null)
  const onFilmstripViewableChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      setFilmstripVisibleIds(
        viewableItems
          .map((token) => (token.item as T | undefined)?.participant.identity)
          .filter((identity): identity is string => !!identity),
      )
    },
  ).current
  const filmstripViewabilityConfig = useRef({ itemVisiblePercentThreshold: 10 }).current
  // Scrolling gallery: tile index range on screen, for camera subscriptions.
  const [galleryVisibleRange, setGalleryVisibleRange] = useState<{
    first: number
    last: number
  } | null>(null)
  const onGalleryViewableChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const indexes = viewableItems
        .map((token) => token.index)
        .filter((index): index is number => typeof index === 'number')
      if (indexes.length === 0) return
      const first = Math.min(...indexes)
      const last = Math.max(...indexes)
      setGalleryVisibleRange((prev) =>
        prev && prev.first === first && prev.last === last ? prev : { first, last },
      )
    },
  ).current
  const galleryViewabilityConfig = useRef({ itemVisiblePercentThreshold: 10 }).current
  const hasScreenShare = layoutState.hasScreenShare
  const isLocalScreenSharing = layoutState.isLocalScreenSharing
  const previousScreenShare = useRef(false)
  const pager = useMeetingStagePager({
    cameraTiles: layoutState.cameraTiles,
    hasScreenShare,
  })

  useEffect(() => {
    if (hasScreenShare && !previousScreenShare.current) {
      dispatch({ type: 'SET_VIEW', viewMode: 'screen-share' })
      setScreenShareBannerVisible(true)
    } else if (!hasScreenShare && state.viewMode === 'screen-share') {
      dispatch({ type: 'SET_VIEW', viewMode: 'speaker' })
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

  const showFilmstrip = layoutState.filmstripTracks.length > 0
  const speakerMode = state.viewMode === 'speaker'
  // Speaker view always keeps a filmstrip of the other participants (side on
  // wide layouts, bottom strip on portrait phones).
  const filmstripBeside = speakerMode
    ? layout.filmstripBeside || width >= 700 || state.sideBySideShare
    : layout.filmstripBeside || state.sideBySideShare
  const filmstripExpanded = showFilmstrip && !state.participantStripMinimized
  const screenLayout = state.viewMode === 'screen-share' && hasScreenShare
  const galleryMode = state.viewMode === 'gallery' || (!screenLayout && !speakerMode)
  const { width: mainWidth, height: mainHeight } = meetingStageContentBox({
    viewportWidth: width,
    viewportHeight: height,
    layout: speakerMode
      ? {
          ...layout,
          filmstripBeside,
          filmstripWidth: filmstripBeside ? Math.max(layout.filmstripWidth, 112) : layout.filmstripWidth,
          filmstripHeight: filmstripBeside ? layout.filmstripHeight : Math.max(layout.filmstripHeight, 92),
        }
      : layout,
    filmstripExpanded,
    stageTrailingInset,
  })
  const stageTracks = useMemo(() => {
    return layoutState.stageTracks
  }, [layoutState.stageTracks])
  // One screen holds `pageSize` tiles; the rest continue below and scroll in.
  const minTileHeight = layout.policy === 'landscape-phone' ? 72 : 100
  const gallery = meetingGalleryScrollLayout(stageTracks.length, {
    screenSize: pageSize,
    width: mainWidth,
    height: mainHeight,
    gap: STAGE_GAP,
    minRowHeight: minTileHeight,
    preferWide: layout.galleryPreferWide,
  })
  const galleryScrolls = galleryMode && gallery.scrolls
  const galleryTileWidth = Math.floor(
    (mainWidth - STAGE_GAP * Math.max(gallery.columns - 1, 0)) / gallery.columns,
  )
  const galleryTileHeight = gallery.rowHeight
  useEffect(() => {
    if (!galleryScrolls) setGalleryVisibleRange(null)
  }, [galleryScrolls, gallery.columns])
  const renderStageTile = (trackRef: T, index: number, tileWidth: number, tileHeight: number) => {
    const isScreen =
      trackRef.source === SCREEN_SHARE_SOURCE ||
      trackRef.publication?.source === SCREEN_SHARE_SOURCE
    return renderTile({
      trackRef,
      name: participantDisplayName(trackRef.participant),
      isScreen,
      localScreenShareActive: isLocalScreenSharing,
      width: tileWidth,
      height: Math.max(tileHeight, minTileHeight),
      radius: screenLayout && index === 0 ? coworkUi.radius.tile : 14,
      mirrorLocalVideo: selfViewMirror,
      hdVideo: hdVideoPref,
      activeSpeaker:
        !isScreen &&
        (!!trackRef.participant.isSpeaking ||
          trackRef.participant.identity === activeSpeakerIdentity),
    })
  }

  const pageSlide = useRef(new Animated.Value(0)).current
  // Set when a touch starts on the filmstrip or floating tile, which own their drags.
  const stageSwipeBlockedRef = useRef(false)
  const stageSwipeRef = useRef<{
    enabled: boolean
    canGoNext: boolean
    canGoPrev: boolean
    width: number
    turn: (direction: MeetingStageSwipeDirection) => boolean
  }>({ enabled: false, canGoNext: false, canGoPrev: false, width: 0, turn: () => false })
  stageSwipeRef.current = {
    enabled: pager.pages.length > 1,
    canGoNext: pager.canGoNext,
    canGoPrev: pager.canGoPrev,
    width: mainWidth,
    turn: pager.swipe,
  }
  const stagePanResponder = useMemo(() => {
    const settle = () =>
      Animated.timing(pageSlide, { toValue: 0, duration: 180, useNativeDriver: true }).start()
    return PanResponder.create({
      // Runs before the filmstrip's onTouchStart for the same touch.
      onStartShouldSetPanResponderCapture: () => {
        stageSwipeBlockedRef.current = false
        return false
      },
      onMoveShouldSetPanResponder: (_, gesture) =>
        stageSwipeRef.current.enabled &&
        !stageSwipeBlockedRef.current &&
        meetingStageIsHorizontalDrag(gesture.dx, gesture.dy),
      onPanResponderMove: (_, gesture) => {
        const swipe = stageSwipeRef.current
        pageSlide.setValue(meetingStageDragOffset(gesture.dx, swipe.canGoNext, swipe.canGoPrev))
      },
      onPanResponderRelease: (_, gesture) => {
        const swipe = stageSwipeRef.current
        const direction = meetingStageSwipeDirection({
          dx: gesture.dx,
          dy: gesture.dy,
          vx: gesture.vx,
          width: swipe.width,
        })
        if (direction && swipe.turn(direction)) {
          pageSlide.setValue(
            direction === 'next' ? STAGE_PAGE_ENTER_OFFSET : -STAGE_PAGE_ENTER_OFFSET,
          )
        }
        settle()
      },
      onPanResponderTerminate: settle,
      onPanResponderTerminationRequest: () => true,
    })
  }, [pageSlide])
  const blockStageSwipe = () => {
    stageSwipeBlockedRef.current = true
  }

  useEffect(() => {
    // Scrolling gallery: rows on screen plus one row either side.
    const range = galleryVisibleRange ?? {
      first: 0,
      last: gallery.columns * (gallery.visibleRows + 1) - 1,
    }
    const identities = new Set<string>(
      (galleryScrolls
        ? stageTracks.slice(
            Math.max(0, range.first - gallery.columns),
            range.last + 1 + gallery.columns,
          )
        : stageTracks
      ).map((track) => track.participant.identity),
    )
    const filmstripIdentities =
      filmstripVisibleIds ??
      filmstripTracks
        .slice(0, FILMSTRIP_INITIAL_VISIBLE)
        .map((track) => track.participant.identity)
    for (const identity of filmstripIdentities) identities.add(identity)
    for (const track of stageTracks) {
      if (track.participant.isSpeaking) identities.add(track.participant.identity)
    }
    if (floatingTrack) identities.add(floatingTrack.participant.identity)
    onVisibleIdentities(identities)
  }, [
    filmstripTracks,
    filmstripVisibleIds,
    floatingTrack,
    gallery.columns,
    gallery.visibleRows,
    galleryScrolls,
    galleryVisibleRange,
    onVisibleIdentities,
    stageTracks,
  ])

  return (
    <View style={{ flex: 1, width: '100%', height: '100%' }} {...stagePanResponder.panHandlers}>
    <Pressable
      onPress={triggerStageTap}
      accessible={false}
      style={{ flex: 1, width: '100%', height: '100%' }}
    >
    <YStack
      flex={1}
      width="100%"
      height="100%"
      backgroundColor={coworkUi.pageBg}
      paddingTop={layout.stagePaddingTop}
      paddingBottom={layout.stagePaddingBottom}
      paddingLeft={layout.stagePaddingLeft}
      paddingRight={layout.stagePaddingRight + stageTrailingInset}
    >
      {stageTracks.length === 0 ? (
        <YStack
          flex={1}
          width="100%"
          alignItems="center"
          justifyContent="center"
          borderRadius={coworkUi.radius.tile}
          backgroundColor={coworkUi.tileBg}
          borderWidth={1}
          borderColor={coworkUi.tileBorder}
        >
          <Text color={coworkUi.textSecondary} fontSize={15} fontWeight="600">
            {isLocalScreenSharing ? 'You’re presenting' : 'Waiting for video…'}
          </Text>
          <Text color={coworkUi.textMuted} fontSize={13} marginTop="$2">
            {isLocalScreenSharing
              ? 'Your screen is visible to other participants'
              : 'Turn on your camera or wait for others to join'}
          </Text>
        </YStack>
      ) : (
        <YStack flex={1} width="100%" height="100%" position="relative">
          <Animated.View style={{ transform: [{ translateX: pageSlide }] }}>
            {galleryScrolls ? (
              <FlatList
                key={`gallery-${gallery.columns}`}
                data={stageTracks}
                keyExtractor={(trackRef) => tileKey(trackRef)}
                numColumns={gallery.columns}
                renderItem={({ item: trackRef, index }) => (
                  <>{renderStageTile(trackRef, index, galleryTileWidth, galleryTileHeight)}</>
                )}
                style={{ width: mainWidth, height: mainHeight }}
                columnWrapperStyle={{ gap: STAGE_GAP, justifyContent: 'center' }}
                contentContainerStyle={{ gap: STAGE_GAP }}
                showsVerticalScrollIndicator={false}
                getItemLayout={(_, row) => ({
                  length: galleryTileHeight + STAGE_GAP,
                  offset: (galleryTileHeight + STAGE_GAP) * row,
                  index: row,
                })}
                initialNumToRender={gallery.columns * (gallery.visibleRows + 1)}
                windowSize={5}
                onViewableItemsChanged={onGalleryViewableChanged}
                viewabilityConfig={galleryViewabilityConfig}
              />
            ) : (
            <XStack
              width={mainWidth}
              height={mainHeight}
              flexWrap={screenLayout ? 'nowrap' : 'wrap'}
              alignContent={screenLayout || stageTracks.length <= 1 ? 'stretch' : 'center'}
              justifyContent="center"
              gap={STAGE_GAP}
            >
              {stageTracks.map((trackRef, index) => {
                const tileWidth = screenLayout ? mainWidth : galleryTileWidth
                const tileHeight = screenLayout
                  ? index === 0
                    ? mainHeight
                    : Math.floor(mainHeight / 3)
                  : gallery.rowHeight
                return (
                  <Fragment key={tileKey(trackRef)}>
                    {renderStageTile(trackRef, index, tileWidth, tileHeight)}
                  </Fragment>
                )
              })}
            </XStack>
            )}
          </Animated.View>

          {floatingTrack ? (
            <NativeFloatingVideoTile
              key={`${stageTrackKey(floatingTrack)}-floating`}
              trackRef={floatingTrack}
              areaWidth={mainWidth}
              areaHeight={mainHeight}
              localScreenShareActive={isLocalScreenSharing}
              mirrorLocalVideo={selfViewMirror}
              hdVideo={hdVideoPref}
              activeSpeaker={!!floatingTrack.participant.isSpeaking}
              renderTile={renderTile}
            />
          ) : null}

          {filmstripExpanded ? (
            <FlatList
              key={filmstripBeside ? 'filmstrip-side' : 'filmstrip-bottom'}
              data={filmstripTracks}
              keyExtractor={(trackRef) => `${stageTrackKey(trackRef)}-strip`}
              renderItem={({ item: trackRef }) => (
                <View
                  style={
                    filmstripBeside
                      ? { marginBottom: FILMSTRIP_GAP }
                      : { marginRight: FILMSTRIP_GAP }
                  }
                >
                  {renderTile({
                    trackRef,
                    name: participantDisplayName(trackRef.participant),
                    isScreen: false,
                    localScreenShareActive: isLocalScreenSharing,
                    width: layout.pipWidth,
                    height: layout.pipHeight,
                    radius: 10,
                    compact: true,
                    mirrorLocalVideo: selfViewMirror,
                    hdVideo: hdVideoPref,
                    activeSpeaker: !!trackRef.participant.isSpeaking,
                  })}
                </View>
              )}
              style={{
                position: 'absolute',
                right: 0,
                bottom: filmstripBeside ? undefined : 0,
                top: filmstripBeside ? 0 : undefined,
                width: filmstripBeside ? layout.filmstripWidth : '100%',
                height: filmstripBeside ? mainHeight : layout.filmstripHeight,
              }}
              horizontal={!filmstripBeside}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              getItemLayout={(_, index) => {
                const length =
                  (filmstripBeside ? layout.pipHeight : layout.pipWidth) + FILMSTRIP_GAP
                return { length, offset: length * index, index }
              }}
              initialNumToRender={FILMSTRIP_INITIAL_VISIBLE}
              windowSize={5}
              onTouchStart={blockStageSwipe}
              onViewableItemsChanged={onFilmstripViewableChanged}
              viewabilityConfig={filmstripViewabilityConfig}
            />
          ) : null}
          {showFilmstrip ? (
            <YStack
              position="absolute"
              right={filmstripBeside ? 4 : 8}
              bottom={
                filmstripBeside ? 4 : filmstripExpanded ? layout.filmstripHeight + 4 : 8
              }
              width={44}
              height={44}
              zIndex={25}
              alignItems="center"
              justifyContent="center"
              borderRadius={999}
              backgroundColor="rgba(12,8,10,0.9)"
              borderWidth={1}
              borderColor="rgba(255,255,255,0.18)"
              accessibilityRole="button"
              accessibilityLabel={
                state.participantStripMinimized
                  ? 'Maximize participant filmstrip'
                  : 'Minimize participant filmstrip'
              }
              onPress={() => dispatch({ type: 'TOGGLE_PARTICIPANT_STRIP' })}
            >
              <Text
                color="#fff"
                fontSize={20}
                fontWeight="800"
                lineHeight={24}
              >
                {state.participantStripMinimized ? '+' : '−'}
              </Text>
            </YStack>
          ) : null}
        </YStack>
      )}
      {pager.pages.length > 1 && state.controlsVisible ? (
        <XStack
          position="absolute"
          bottom={
            layout.stagePaddingBottom +
            (filmstripExpanded && !filmstripBeside ? layout.filmstripHeight + 8 : 6)
          }
          alignSelf="center"
          zIndex={28}
          alignItems="center"
          gap={7}
          paddingHorizontal={8}
          paddingVertical={5}
          borderRadius={999}
          backgroundColor="rgba(12,8,10,0.55)"
          accessibilityRole="tablist"
        >
          {pager.pages.map((page, index) => (
            <Pressable
              key={meetingStagePageKey(page)}
              onPress={() => pager.goTo(page)}
              hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
              accessibilityRole="tab"
              accessibilityLabel={meetingStagePageLabel(page)}
              accessibilityState={{ selected: index === pager.index }}
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                backgroundColor: index === pager.index ? '#fff' : 'rgba(255,255,255,0.4)',
              }}
            />
          ))}
        </XStack>
      ) : null}
      {(() => {
        const presenting = isLocalScreenSharing && !!onStopScreenShare
        if (!screenShareBannerVisible && !presenting) return null
        const label = screenShareRoleLabel(
          isLocalScreenSharing ? 'sharing' : hasScreenShare ? 'viewing' : 'none',
        )
        return label ? (
          <YStack
            position="absolute"
            top={layout.stagePaddingTop + 8}
            left={layout.stagePaddingLeft + 8}
            maxWidth={320}
            zIndex={30}
            paddingHorizontal="$3"
            paddingVertical="$2"
            borderRadius={12}
            backgroundColor={
              isLocalScreenSharing ? 'rgba(5,150,105,0.94)' : 'rgba(37,99,235,0.92)'
            }
            borderWidth={1}
            borderColor={
              isLocalScreenSharing ? 'rgba(167,243,208,0.48)' : 'rgba(147,197,253,0.5)'
            }
            pointerEvents={presenting ? 'box-none' : 'none'}
            flexDirection="row"
            alignItems="center"
            gap="$2.5"
          >
            <Text color="#ecfdf5" fontSize={12} fontWeight="700" flexShrink={1}>
              {label}
            </Text>
            {presenting ? (
              <Pressable
                onPress={onStopScreenShare}
                accessibilityRole="button"
                accessibilityLabel="Stop sharing your screen"
                hitSlop={8}
                style={{
                  backgroundColor: '#E02828',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text color="#fff" fontSize={12} fontWeight="800">
                  Stop Share
                </Text>
              </Pressable>
            ) : null}
          </YStack>
        ) : null
      })()}
    </YStack>
    </Pressable>
    </View>
  )
}

/** Zoom-style 1:1 self-view: drag to any corner without promoting it into the stage. */
function NativeFloatingVideoTile<T extends MeetingStageTrack>({
  trackRef,
  areaWidth,
  areaHeight,
  localScreenShareActive,
  mirrorLocalVideo,
  hdVideo,
  activeSpeaker,
  renderTile,
}: {
  trackRef: T
  renderTile: (props: NativeStageTileProps<T>) => ReactNode
  areaWidth: number
  areaHeight: number
  localScreenShareActive: boolean
  mirrorLocalVideo: boolean
  hdVideo: boolean
  activeSpeaker: boolean
}) {
  const { triggerStageTap } = useMeetingLiveSignals()
  const tile = meetingFloatingTileSize({ width: areaWidth, height: areaHeight })
  const area = { width: areaWidth, height: areaHeight }
  const [corner, setCorner] = useState<MeetingFloatingCorner>('bottom-right')
  const position = useRef(
    new Animated.ValueXY(meetingFloatingCornerOrigin('bottom-right', area, tile)),
  ).current
  const dragOriginRef = useRef({ x: 0, y: 0 })
  const latest = useRef({ area, tile, corner })
  latest.current = { area, tile, corner }

  const snapTo = (next: MeetingFloatingCorner) => {
    const { area: currentArea, tile: currentTile } = latest.current
    Animated.spring(position, {
      toValue: meetingFloatingCornerOrigin(next, currentArea, currentTile),
      useNativeDriver: false,
      bounciness: 4,
      speed: 18,
    }).start()
  }

  useEffect(() => {
    snapTo(corner)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corner, areaWidth, areaHeight, tile.width, tile.height])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Claim every touch so the tile's own press/long-press never fires underneath.
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          position.stopAnimation((value) => {
            dragOriginRef.current = value
          })
        },
        onPanResponderMove: (_, gesture) => {
          const origin = dragOriginRef.current
          position.setValue({ x: origin.x + gesture.dx, y: origin.y + gesture.dy })
        },
        onPanResponderRelease: (_, gesture) => {
          const current = latest.current
          if (Math.hypot(gesture.dx, gesture.dy) < MEETING_FLOATING_DRAG_SLOP) {
            snapTo(current.corner)
            triggerStageTap()
            return
          }
          const origin = dragOriginRef.current
          const next = meetingFloatingCornerForPoint(
            {
              x: origin.x + gesture.dx + current.tile.width / 2,
              y: origin.y + gesture.dy + current.tile.height / 2,
            },
            current.area,
          )
          if (next === current.corner) snapTo(next)
          else setCorner(next)
        },
        onPanResponderTerminate: () => snapTo(latest.current.corner),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [position, triggerStageTap],
  )

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: tile.width,
        height: tile.height,
        zIndex: 20,
        elevation: 8,
        transform: position.getTranslateTransform(),
      }}
    >
      <Fragment key={stageTrackKey(trackRef)}>
        {renderTile({
          trackRef,
          name: participantDisplayName(trackRef.participant),
          isScreen: false,
          localScreenShareActive,
          width: tile.width,
          height: tile.height,
          radius: 12,
          compact: true,
          floating: true,
          mirrorLocalVideo,
          hdVideo,
          activeSpeaker,
        })}
      </Fragment>
    </Animated.View>
  )
}
