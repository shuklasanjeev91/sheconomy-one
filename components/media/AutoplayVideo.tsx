import { createElement, useEffect, useId, useRef, useState } from 'react'
import { Platform, StyleSheet, View } from 'react-native'
import Constants from 'expo-constants'
import { useVideoPlayer, VideoView } from 'expo-video'

import { resolveAppOrigin } from '~/config/app-origin'
import {
  claimAutoplay,
  releaseAutoplay,
  subscribeAutoplay,
} from '~/lib/media/autoplay-controller'
import { parseVideoProvider } from '~/lib/link-preview'
import {
  extractYoutubeId,
  getVideoPosterUrl,
  videoSrcWithFirstFrame,
} from '~/lib/media/video-thumbnail'
import { useInView } from '~/hooks/useInView'
import { Icons, Image, Text, XStack, YStack } from '~/components/ui'

/** YouTube Error 153 fix — embedded players require `https://` + app package / bundle id. */
function youtubeEmbedReferer(): string {
  const bundleId =
    (Platform.OS === 'ios'
      ? Constants.expoConfig?.ios?.bundleIdentifier
      : Constants.expoConfig?.android?.package) || 'com.sheconomy.ecommerce'
  return `https://${bundleId}`
}

function buildYoutubeEmbedSrc(youtubeId: string, muted: boolean): string {
  const origin = encodeURIComponent(resolveAppOrigin())
  return (
    `https://www.youtube.com/embed/${youtubeId}` +
    `?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${youtubeId}` +
    `&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${origin}`
  )
}

type AutoplayVideoProps = {
  src: string
  posterUrl?: string | null
  /** Frame height; width fills parent. */
  height?: number | string
  aspectRatio?: number
  objectFit?: 'cover' | 'contain'
  /** LinkedIn-style muted autoplay when ≥55% visible (default true). */
  autoplayInView?: boolean
  borderRadius?: number
}

/**
 * LinkedIn-style video: muted autoplay when ≥55% visible, pause when scrolled away,
 * exclusive (one at a time), unmute/mute toggle, loops while active.
 * YouTube/Vimeo watch URLs and direct files — web + iOS + Android (no `.native.tsx`).
 */
export function AutoplayVideo({
  src,
  posterUrl = null,
  height,
  aspectRatio = 16 / 9,
  objectFit = 'contain',
  autoplayInView = true,
  borderRadius = 0,
}: AutoplayVideoProps) {
  const reactId = useId()
  const playerId = `autoplay-${reactId}`
  // Measure a real RN View — Tamagui stacks don't reliably expose measureInWindow.
  const { ref, inView } = useInView({ threshold: 0.55, enabled: autoplayInView })
  const [isActive, setIsActive] = useState(false)
  const [muted, setMuted] = useState(true)
  const [userPaused, setUserPaused] = useState(false)
  const poster = getVideoPosterUrl(src, posterUrl)
  const provider = parseVideoProvider(src)
  const youtubeId =
    extractYoutubeId(src) ?? (provider?.provider === 'youtube' ? provider.id : null)
  const vimeoEmbed = provider?.provider === 'vimeo' ? provider.embed : null

  useEffect(() => subscribeAutoplay((active) => setIsActive(active === playerId)), [playerId])

  useEffect(() => {
    if (!autoplayInView) return
    if (inView && !userPaused) {
      claimAutoplay(playerId)
      return
    }
    releaseAutoplay(playerId)
  }, [autoplayInView, inView, playerId, userPaused])

  useEffect(() => {
    return () => releaseAutoplay(playerId)
  }, [playerId])

  const shouldPlay = autoplayInView && isActive && !userPaused

  const frameStyle = {
    width: '100%' as const,
    height: typeof height === 'number' ? height : height === '100%' ? ('100%' as const) : undefined,
    aspectRatio: height ? undefined : aspectRatio,
    backgroundColor: '#000',
    overflow: 'hidden' as const,
    borderRadius,
    position: 'relative' as const,
  }

  return (
    <View ref={ref as never} style={frameStyle} collapsable={false}>
      {youtubeId ? (
        <YoutubeAutoplay
          youtubeId={youtubeId}
          title="Video"
          shouldPlay={shouldPlay}
          muted={muted}
          poster={poster}
        />
      ) : vimeoEmbed ? (
        <IframeAutoplay
          embedSrc={`${vimeoEmbed}?autoplay=1&muted=${muted ? 1 : 0}&loop=1`}
          title="Video"
          shouldPlay={shouldPlay}
          poster={poster}
        />
      ) : Platform.OS === 'web' ? (
        <WebFileAutoplay
          src={src}
          poster={poster}
          objectFit={objectFit}
          shouldPlay={shouldPlay}
          muted={muted}
        />
      ) : (
        <NativeFileAutoplay
          uri={src}
          posterUri={poster}
          shouldPlay={shouldPlay}
          muted={muted}
          objectFit={objectFit}
        />
      )}

      <XStack position="absolute" bottom={10} right={10} gap="$2" alignItems="center" zIndex={4}>
        <ControlChip
          label={muted ? 'Unmute' : 'Mute'}
          onPress={() => setMuted((value) => !value)}
          icon={muted ? Icons.VolumeX : Icons.Volume2}
        />
        <ControlChip
          label={userPaused || !shouldPlay ? 'Play' : 'Pause'}
          onPress={() => {
            if (userPaused) {
              setUserPaused(false)
              claimAutoplay(playerId)
              return
            }
            if (shouldPlay) {
              setUserPaused(true)
              releaseAutoplay(playerId)
              return
            }
            setUserPaused(false)
            claimAutoplay(playerId)
          }}
          icon={userPaused || !shouldPlay ? Icons.Play : Icons.Pause}
        />
      </XStack>
    </View>
  )
}

function ControlChip({
  label,
  onPress,
  icon: Icon,
}: {
  label: string
  onPress: () => void
  icon: typeof Icons.Play
}) {
  return (
    <XStack
      onPress={onPress}
      cursor="pointer"
      alignItems="center"
      gap={6}
      paddingHorizontal={10}
      paddingVertical={7}
      borderRadius={999}
      backgroundColor="rgba(0,0,0,0.62)"
      borderWidth={1}
      borderColor="rgba(255,255,255,0.28)"
      pressStyle={{ opacity: 0.85, scale: 0.97 }}
      aria-label={label}
    >
      <Icon size={14} color="#fff" />
      <Text fontSize={12} fontWeight="600" color="#fff">
        {label}
      </Text>
    </XStack>
  )
}

function YoutubeAutoplay({
  youtubeId,
  title,
  shouldPlay,
  muted,
  poster,
}: {
  youtubeId: string
  title: string
  shouldPlay: boolean
  muted: boolean
  poster: string | null
}) {
  if (!shouldPlay) {
    return poster ? (
      <Image src={poster} width="100%" height="100%" objectFit="cover" alt={title} />
    ) : (
      <YStack flex={1} backgroundColor="#111" />
    )
  }

  const embedSrc = buildYoutubeEmbedSrc(youtubeId, muted)

  if (Platform.OS === 'web') {
    return createElement('iframe', {
      key: embedSrc,
      src: embedSrc,
      title,
      allow:
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowFullScreen: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      style: { width: '100%', height: '100%', border: 0, backgroundColor: '#000' },
    })
  }

  return <NativeYoutubeEmbed key={embedSrc} embedSrc={embedSrc} title={title} />
}

function IframeAutoplay({
  embedSrc,
  title,
  shouldPlay,
  poster,
}: {
  embedSrc: string
  title: string
  shouldPlay: boolean
  poster: string | null
}) {
  if (!shouldPlay) {
    return poster ? (
      <Image src={poster} width="100%" height="100%" objectFit="cover" alt={title} />
    ) : (
      <YStack flex={1} backgroundColor="#111" />
    )
  }

  if (Platform.OS === 'web') {
    return createElement('iframe', {
      key: embedSrc,
      src: embedSrc,
      title,
      allow:
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowFullScreen: true,
      style: { width: '100%', height: '100%', border: 0, backgroundColor: '#000' },
    })
  }

  return <NativeIframeEmbed key={embedSrc} src={embedSrc} title={title} />
}

function NativeIframeEmbed({ src, title }: { src: string; title: string }) {
  const [WebView, setWebView] = useState<React.ComponentType<Record<string, unknown>> | null>(null)
  const isYoutube = /youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(src)

  useEffect(() => {
    void import('react-native-webview').then((module) => setWebView(() => module.WebView as never))
  }, [])

  if (!WebView) return <YStack flex={1} backgroundColor="#111" />

  return (
    <WebView
      source={{
        uri: src,
        ...(isYoutube ? { headers: { Referer: youtubeEmbedReferer() } } : null),
      }}
      style={StyleSheet.absoluteFillObject}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      originWhitelist={['*']}
      setSupportMultipleWindows={false}
      accessibilityLabel={title}
    />
  )
}

/**
 * Native YouTube embed — loads the official /embed URL with an explicit Referer.
 * Missing Referer triggers YouTube "Error 153: Video player configuration error".
 */
function NativeYoutubeEmbed({ embedSrc, title }: { embedSrc: string; title: string }) {
  const [WebView, setWebView] = useState<React.ComponentType<Record<string, unknown>> | null>(null)

  useEffect(() => {
    void import('react-native-webview').then((module) => setWebView(() => module.WebView as never))
  }, [])

  if (!WebView) return <YStack flex={1} backgroundColor="#111" />

  return (
    <WebView
      source={{
        uri: embedSrc,
        headers: {
          Referer: youtubeEmbedReferer(),
        },
      }}
      style={StyleSheet.absoluteFillObject}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      nestedScrollEnabled={false}
      originWhitelist={['*']}
      setSupportMultipleWindows={false}
      accessibilityLabel={title}
    />
  )
}

function WebFileAutoplay({
  src,
  poster,
  objectFit,
  shouldPlay,
  muted,
}: {
  src: string
  poster: string | null
  objectFit: 'cover' | 'contain'
  shouldPlay: boolean
  muted: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    el.muted = muted
    if (shouldPlay) {
      void el.play().catch(() => {
        el.muted = true
        void el.play().catch(() => {})
      })
    } else {
      el.pause()
    }
  }, [shouldPlay, muted])

  return createElement('video', {
    ref: videoRef,
    src: videoSrcWithFirstFrame(src),
    muted,
    playsInline: true,
    loop: true,
    preload: 'metadata',
    poster: poster ?? undefined,
    controls: false,
    style: {
      width: '100%',
      height: '100%',
      objectFit,
      backgroundColor: '#000',
    },
  })
}

function NativeFileAutoplay({
  uri,
  posterUri,
  shouldPlay,
  muted,
  objectFit,
}: {
  uri: string
  posterUri: string | null
  shouldPlay: boolean
  muted: boolean
  objectFit: 'cover' | 'contain'
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true
    instance.muted = true
  })

  useEffect(() => {
    player.muted = muted
  }, [muted, player])

  useEffect(() => {
    try {
      if (shouldPlay) player.play()
      else player.pause()
    } catch {
      // ignore
    }
  }, [shouldPlay, player])

  if (!shouldPlay && posterUri) {
    return <Image src={posterUri} width="100%" height="100%" objectFit="cover" alt="" />
  }

  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      nativeControls={false}
      contentFit={objectFit}
    />
  )
}
