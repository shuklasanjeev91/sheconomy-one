import { createElement, useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type MutableRefObject } from 'react'
import { Image, Linking, Platform, StyleSheet, View } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'

import { RnPressable as Pressable } from '~/co-work/components/RnPressable'
import { Icons, Text, XStack, YStack } from '~/components/ui'
import {
  MEETING_CONTENT_PAUSED_DRIFT_SEC,
  MEETING_CONTENT_VIDEO_DRIFT_SEC,
  meetingContentNeedsSeek,
  meetingContentTitle,
  meetingContentVideoPosition,
  meetingContentViewer,
  type MeetingContentItem,
  type MeetingContentPlatform,
  type MeetingContentShare,
} from '~/co-work/lib/meeting-content-share'
import { useCoWorkTheme, useMeetingControlPalette } from '~/co-work/lib/theme'
import { detectMobileDevice } from '~/lib/utils/mobile-detection'

type ContentPatch = Partial<Pick<MeetingContentShare, 'index' | 'page' | 'playing' | 'positionSec'>>

type MeetingContentShareStageProps = {
  share: MeetingContentShare
  /** Local time the latest update arrived (video sync). */
  receivedAt: number
  isPresenter: boolean
  top: number
  bottom: number
  left: number
  right: number
  onUpdate: (patch: ContentPatch) => void
  onStop: () => void
  onHide: () => void
  onToggleControls?: () => void
}

function contentPlatform(): MeetingContentPlatform {
  if (Platform.OS === 'ios') return 'ios'
  if (Platform.OS === 'android') return 'android'
  return detectMobileDevice().isMobile ? 'web-mobile' : 'web'
}

function kindIcon(item: MeetingContentItem | undefined) {
  if (!item) return Icons.FileText
  if (item.kind === 'image') return Icons.Image
  if (item.kind === 'video' || item.kind === 'audio') return Icons.Film
  return Icons.FileText
}

/** Zoom-style shared content on the stage: photos, documents and synced video. */
export function MeetingContentShareStage({
  share,
  receivedAt,
  isPresenter,
  top,
  bottom,
  left,
  right,
  onUpdate,
  onStop,
  onHide,
  onToggleControls,
}: MeetingContentShareStageProps) {
  const { ui } = useCoWorkTheme()
  const platform = useMemo(contentPlatform, [])
  const index = Math.min(Math.max(share.index, 0), share.items.length - 1)
  const item = share.items[index]
  const [reloadKey, setReloadKey] = useState(0)
  const viewer = item ? meetingContentViewer(item, platform, share.page) : null
  const KindIcon = kindIcon(item)
  const multi = share.items.length > 1
  const pdfPaging = item?.kind === 'pdf' && platform === 'web'

  useEffect(() => {
    setReloadKey(0)
  }, [item?.url])

  const title = isPresenter ? 'You are sharing' : `${share.presenterName || 'Someone'} is sharing`

  return (
    <YStack
      position={Platform.OS === 'web' ? ('fixed' as never) : 'absolute'}
      top={top}
      bottom={bottom}
      left={left}
      right={right}
      zIndex={16}
      backgroundColor={ui.pageBg}
      pointerEvents="auto"
      overflow="hidden"
    >
      <XStack
        paddingHorizontal="$3"
        paddingVertical="$2"
        alignItems="center"
        gap="$2"
        backgroundColor={ui.surface}
        borderBottomWidth={1}
        borderBottomColor={ui.borderSoft}
      >
        <Pressable
          onPress={onToggleControls}
          accessibilityLabel={title}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}
        >
          <YStack
            width={30}
            height={30}
            borderRadius={8}
            alignItems="center"
            justifyContent="center"
            backgroundColor="rgba(34,197,94,0.16)"
          >
            <KindIcon size={16} color="#22C55E" />
          </YStack>
          <YStack flex={1} minWidth={0}>
            <Text fontSize={13} fontWeight="800" color={ui.text} numberOfLines={1}>
              {title}
            </Text>
            <Text fontSize={12} color={ui.textSecondary} numberOfLines={1}>
              {meetingContentTitle(share)}
              {pdfPaging ? ` · Page ${share.page}` : ''}
            </Text>
          </YStack>
        </Pressable>

        {isPresenter && (multi || pdfPaging) ? (
          <XStack alignItems="center" gap={4}>
            <HeaderIcon
              label={multi ? 'Previous' : 'Previous page'}
              icon={Icons.ChevronLeft}
              disabled={multi ? index <= 0 : share.page <= 1}
              onPress={() =>
                multi ? onUpdate({ index: index - 1 }) : onUpdate({ page: Math.max(1, share.page - 1) })
              }
            />
            <HeaderIcon
              label={multi ? 'Next' : 'Next page'}
              icon={Icons.ChevronRight}
              disabled={multi ? index >= share.items.length - 1 : false}
              onPress={() => (multi ? onUpdate({ index: index + 1 }) : onUpdate({ page: share.page + 1 }))}
            />
          </XStack>
        ) : null}
        {viewer?.mode === 'frame' ? (
          <HeaderIcon label="Reload" icon={Icons.RotateCw} onPress={() => setReloadKey((key) => key + 1)} />
        ) : null}
        {item ? (
          <HeaderIcon
            label="Open file"
            icon={Icons.ExternalLink}
            onPress={() => void Linking.openURL(item.url).catch(() => {})}
          />
        ) : null}
        {isPresenter ? (
          <Pressable
            onPress={onStop}
            accessibilityRole="button"
            accessibilityLabel="Stop sharing"
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              height: 32,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? '#B91C1C' : '#E02828',
            })}
          >
            <Text fontSize={12} fontWeight="800" color="#FFFFFF">
              Stop share
            </Text>
          </Pressable>
        ) : (
          <HeaderIcon label="Hide shared content" icon={Icons.EyeOff} onPress={onHide} />
        )}
      </XStack>

      <YStack flex={1} minHeight={0} backgroundColor={viewer?.mode === 'frame' ? '#FFFFFF' : '#000000'}>
        {!item || !viewer ? null : viewer.mode === 'image' ? (
          <Pressable onPress={onToggleControls} style={StyleSheet.absoluteFill} accessibilityLabel={item.fileName}>
            <Image source={{ uri: viewer.url }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          </Pressable>
        ) : viewer.mode === 'frame' ? (
          <ContentFrame key={`${item.url}:${reloadKey}`} url={viewer.url} title={item.fileName} />
        ) : (
          <SyncedMedia
            key={item.url}
            url={viewer.url}
            audioOnly={viewer.mode === 'audio'}
            share={share}
            receivedAt={receivedAt}
            isPresenter={isPresenter}
            onUpdate={onUpdate}
          />
        )}
        {multi && !isPresenter ? (
          <YStack
            position="absolute"
            bottom={12}
            alignSelf="center"
            paddingHorizontal={10}
            paddingVertical={4}
            borderRadius={999}
            backgroundColor="rgba(0,0,0,0.6)"
          >
            <Text fontSize={12} fontWeight="700" color="#FFFFFF">
              {index + 1} / {share.items.length}
            </Text>
          </YStack>
        ) : null}
      </YStack>
      <YStack height={2} backgroundColor={ui.brand} opacity={0.6} />
    </YStack>
  )
}

/** Floating stage pill: "View shared content" after hiding, or upload progress. */
export function MeetingContentSharePill({
  top,
  label,
  busy,
  onPress,
}: {
  top: number
  label: string
  busy?: boolean
  onPress?: () => void
}) {
  return (
    <XStack
      position={Platform.OS === 'web' ? ('fixed' as never) : 'absolute'}
      top={top}
      left={0}
      right={0}
      justifyContent="center"
      zIndex={17}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityLabel={label}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: pressed ? 'rgba(21,128,61,0.95)' : 'rgba(22,163,74,0.92)',
        })}
      >
        {busy ? <Icons.RotateCw size={14} color="#FFFFFF" /> : <Icons.Eye size={14} color="#FFFFFF" />}
        <Text fontSize={13} fontWeight="700" color="#FFFFFF" numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </XStack>
  )
}

function HeaderIcon({
  label,
  icon: Icon,
  onPress,
  disabled,
}: {
  label: string
  icon: typeof Icons.X
  onPress: () => void
  disabled?: boolean
}) {
  const palette = useMeetingControlPalette()
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : 1,
        backgroundColor: pressed ? palette.bgPressed : palette.bg,
      })}
    >
      <Icon size={16} color={palette.fg} />
    </Pressable>
  )
}

function ContentFrame({ url, title }: { url: string; title: string }) {
  const [WebView, setWebView] = useState<ComponentType<Record<string, unknown>> | null>(null)

  useEffect(() => {
    if (Platform.OS === 'web') return
    let cancelled = false
    void import('react-native-webview').then((module) => {
      if (!cancelled) setWebView(() => module.WebView as never)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (Platform.OS === 'web') {
    return createElement('iframe', {
      src: url,
      title,
      allow: 'fullscreen; autoplay',
      allowFullScreen: true,
      referrerPolicy: 'no-referrer',
      style: { width: '100%', height: '100%', border: 0, backgroundColor: '#FFFFFF' },
    })
  }

  if (!WebView) return <YStack flex={1} backgroundColor="#FFFFFF" />

  return (
    <WebView
      source={{ uri: url }}
      style={StyleSheet.absoluteFillObject}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      allowsInlineMediaPlayback
      allowsFullscreenVideo
      mediaPlaybackRequiresUserAction={false}
      setSupportMultipleWindows={false}
      scalesPageToFit
      accessibilityLabel={title}
    />
  )
}

type MediaAdapter = {
  time: () => number
  playing: () => boolean
  play: () => void
  pause: () => void
  seek: (sec: number) => void
}

/**
 * The presenter's player drives the share; viewers follow its play state and
 * position, seeking only when they drift past the tolerance.
 */
function SyncedMedia({
  url,
  audioOnly,
  share,
  receivedAt,
  isPresenter,
  onUpdate,
}: {
  url: string
  audioOnly: boolean
  share: MeetingContentShare
  receivedAt: number
  isPresenter: boolean
  onUpdate: (patch: ContentPatch) => void
}) {
  const adapterRef = useRef<MediaAdapter | null>(null)
  const shareRef = useRef(share)
  shareRef.current = share
  const receivedAtRef = useRef(receivedAt)
  receivedAtRef.current = receivedAt
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  const sync = useCallback(() => {
    const adapter = adapterRef.current
    if (!adapter) return
    const current = shareRef.current
    const expected = meetingContentVideoPosition(current, receivedAtRef.current)
    try {
      if (isPresenter) {
        const playing = adapter.playing()
        const time = adapter.time()
        const drift = playing ? MEETING_CONTENT_VIDEO_DRIFT_SEC : MEETING_CONTENT_PAUSED_DRIFT_SEC
        if (playing !== current.playing || meetingContentNeedsSeek(time, expected, drift)) {
          onUpdateRef.current({ playing, positionSec: time })
        }
        return
      }
      if (!current.playing && adapter.playing()) adapter.pause()
      const drift = current.playing ? MEETING_CONTENT_VIDEO_DRIFT_SEC : MEETING_CONTENT_PAUSED_DRIFT_SEC
      if (meetingContentNeedsSeek(adapter.time(), expected, drift)) adapter.seek(expected)
      if (current.playing && !adapter.playing()) adapter.play()
    } catch {
      // Player not ready or released.
    }
  }, [isPresenter])

  useEffect(() => {
    const timer = setInterval(sync, 1000)
    return () => clearInterval(timer)
  }, [sync])

  useEffect(() => {
    if (!isPresenter) sync()
  }, [isPresenter, share.updatedAt, sync])

  return Platform.OS === 'web' ? (
    <WebSyncedMedia url={url} audioOnly={audioOnly} isPresenter={isPresenter} adapterRef={adapterRef} onReady={sync} />
  ) : (
    <NativeSyncedMedia url={url} audioOnly={audioOnly} isPresenter={isPresenter} adapterRef={adapterRef} onReady={sync} />
  )
}

type SyncedMediaViewProps = {
  url: string
  audioOnly: boolean
  isPresenter: boolean
  adapterRef: MutableRefObject<MediaAdapter | null>
  onReady: () => void
}

function WebSyncedMedia({ url, audioOnly, isPresenter, adapterRef, onReady }: SyncedMediaViewProps) {
  const elementRef = useRef<HTMLVideoElement | null>(null)
  const [muted, setMuted] = useState(false)

  const attach = useCallback(
    (element: HTMLVideoElement | null) => {
      elementRef.current = element
      if (!element) {
        adapterRef.current = null
        return
      }
      adapterRef.current = {
        time: () => element.currentTime || 0,
        playing: () => !element.paused && !element.ended,
        play: () => {
          void element.play().catch(() => {
            // Autoplay with sound is blocked until the viewer interacts.
            element.muted = true
            setMuted(true)
            void element.play().catch(() => {})
          })
        },
        pause: () => element.pause(),
        seek: (sec) => {
          element.currentTime = Math.max(0, sec)
        },
      }
    },
    [adapterRef],
  )

  return (
    <View style={StyleSheet.absoluteFill}>
      {audioOnly ? (
        <YStack position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
          <Icons.Volume2 size={48} color="rgba(255,255,255,0.4)" />
        </YStack>
      ) : null}
      {createElement('video', {
        ref: attach,
        src: url,
        playsInline: true,
        controls: isPresenter,
        preload: 'auto',
        onLoadedMetadata: onReady,
        style: { width: '100%', height: '100%', objectFit: 'contain', backgroundColor: 'transparent' },
      })}
      {!isPresenter && muted ? (
        <UnmuteChip
          onPress={() => {
            const element = elementRef.current
            if (!element) return
            element.muted = false
            setMuted(false)
          }}
        />
      ) : null}
    </View>
  )
}

function NativeSyncedMedia({ url, audioOnly, isPresenter, adapterRef, onReady }: SyncedMediaViewProps) {
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false
  })

  useEffect(() => {
    adapterRef.current = {
      time: () => Number(player.currentTime) || 0,
      playing: () => !!player.playing,
      play: () => player.play(),
      pause: () => player.pause(),
      seek: (sec) => {
        player.currentTime = Math.max(0, sec)
      },
    }
    onReady()
    return () => {
      adapterRef.current = null
    }
  }, [adapterRef, onReady, player])

  return (
    <View style={StyleSheet.absoluteFill}>
      {audioOnly ? (
        <YStack position="absolute" top={0} bottom={0} left={0} right={0} alignItems="center" justifyContent="center">
          <Icons.Volume2 size={48} color="rgba(255,255,255,0.4)" />
        </YStack>
      ) : null}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        nativeControls={isPresenter}
        contentFit="contain"
      />
    </View>
  )
}

function UnmuteChip({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Unmute shared video"
      style={{
        position: 'absolute',
        bottom: 14,
        right: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(0,0,0,0.7)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
      }}
    >
      <Icons.VolumeX size={14} color="#FFFFFF" />
      <Text fontSize={12} fontWeight="700" color="#FFFFFF">
        Tap to unmute
      </Text>
    </Pressable>
  )
}
