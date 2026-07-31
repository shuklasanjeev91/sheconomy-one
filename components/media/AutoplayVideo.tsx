import { createElement, useEffect, useId, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { useVideoPlayer, VideoView } from 'expo-video'

import {
  claimAutoplay,
  releaseAutoplay,
  subscribeAutoplay,
} from '~/lib/media/autoplay-controller'
import {
  extractYoutubeId,
  getVideoPosterUrl,
  videoSrcWithFirstFrame,
} from '~/lib/media/video-thumbnail'
import { parseVideoProvider } from '~/lib/link-preview'
import { useInView } from '~/hooks/useInView'
import { openExternalUrl } from '~/lib/platform/openUrl'
import { Icons, Image, Text, XStack, YStack } from '~/components/ui'

type AutoplayVideoProps = {
  src: string
  posterUrl?: string | null
  /** Frame height; width fills parent. */
  height?: number | string
  aspectRatio?: number
  objectFit?: 'cover' | 'contain'
  /** LinkedIn-style muted autoplay when in view (default true). */
  autoplayInView?: boolean
  borderRadius?: number
}

/**
 * LinkedIn-style video: muted autoplay when ≥55% visible, pause when scrolled away,
 * exclusive (one at a time), unmute/mute toggle, loops while active.
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
  const { ref, inView } = useInView({ threshold: 0.55, enabled: autoplayInView })
  const [isActive, setIsActive] = useState(false)
  const [muted, setMuted] = useState(true)
  const [userPaused, setUserPaused] = useState(false)
  const poster = getVideoPosterUrl(src, posterUrl)
  const youtubeId = extractYoutubeId(src)
  const provider = !youtubeId ? parseVideoProvider(src) : null
  const iframeEmbed =
    youtubeId != null
      ? null
      : provider?.provider === 'vimeo'
        ? `${provider.embed}${provider.embed.includes('?') ? '&' : '?'}autoplay=1&muted=${muted ? 1 : 0}`
        : /\/embed\/|player\.vimeo\.com/i.test(src)
          ? src
          : null

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

  return (
    <YStack
      ref={ref as never}
      width="100%"
      height={height}
      aspectRatio={height ? undefined : aspectRatio}
      backgroundColor="#000"
      overflow="hidden"
      borderRadius={borderRadius}
      position="relative"
    >
      {youtubeId ? (
        <YoutubeAutoplay
          youtubeId={youtubeId}
          title="Video"
          shouldPlay={shouldPlay}
          muted={muted}
          poster={poster}
        />
      ) : iframeEmbed ? (
        <IframeAutoplay
          src={iframeEmbed}
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
    </YStack>
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
  // Always show a poster/playable surface — never leave a blank black box when
  // inView measurement lags (common on native scroll lists).
  if (!shouldPlay) {
    return poster ? (
      <Image src={poster} width="100%" height="100%" objectFit="cover" alt={title} />
    ) : (
      <YStack flex={1} backgroundColor="#111" alignItems="center" justifyContent="center">
        <Icons.Play size={28} color="#fff" fill="#fff" />
      </YStack>
    )
  }

  if (Platform.OS === 'web') {
    const embedSrc = youtubeEmbedUrl(youtubeId, {
      autoplay: true,
      muted,
      // Browser page origin is sent automatically; do not spoof youtube.com.
      origin: typeof window !== 'undefined' ? window.location.origin : 'https://sheconomy.in',
    })
    return createElement('iframe', {
      key: embedSrc,
      src: embedSrc,
      title,
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowFullScreen: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      style: { width: '100%', height: '100%', border: 0, backgroundColor: '#000' },
    })
  }

  return <NativeYoutubeEmbed youtubeId={youtubeId} muted={muted} poster={poster} title={title} />
}

/**
 * YouTube requires a real HTTPS Referer / origin for embeds (Error 152-4 / 153
 * without one). Native apps must send `https://{applicationId}` per YT docs.
 */
const NATIVE_YT_ORIGIN = 'https://com.sheconomy.ecommerce'
const NATIVE_YT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36'

function youtubeEmbedUrl(
  youtubeId: string,
  opts: { autoplay: boolean; muted: boolean; origin: string },
): string {
  const params = new URLSearchParams({
    autoplay: opts.autoplay ? '1' : '0',
    mute: opts.muted ? '1' : '0',
    controls: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    enablejsapi: '1',
    origin: opts.origin,
  })
  return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`
}

function youtubeEmbedHtml(youtubeId: string, muted: boolean): string {
  const src = youtubeEmbedUrl(youtubeId, {
    autoplay: true,
    muted,
    origin: NATIVE_YT_ORIGIN,
  })
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<meta name="referrer" content="strict-origin-when-cross-origin"/>
<style>html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style>
</head><body>
<iframe
  src="${src}"
  title="YouTube"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
  allowfullscreen
  referrerpolicy="strict-origin-when-cross-origin"
></iframe>
</body></html>`
}

function IframeAutoplay({
  src,
  title,
  shouldPlay,
  poster,
}: {
  src: string
  title: string
  shouldPlay: boolean
  poster: string | null
}) {
  if (!shouldPlay) {
    return poster ? (
      <Image src={poster} width="100%" height="100%" objectFit="cover" alt={title} />
    ) : (
      <YStack flex={1} backgroundColor="#111" alignItems="center" justifyContent="center">
        <Icons.Play size={28} color="#fff" fill="#fff" />
      </YStack>
    )
  }

  if (Platform.OS === 'web') {
    return createElement('iframe', {
      key: src,
      src,
      title,
      allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      allowFullScreen: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      style: { width: '100%', height: '100%', border: 0, backgroundColor: '#000' },
    })
  }

  return (
    <NativeHtmlEmbed
      html={vimeoEmbedHtml(src)}
      baseUrl="https://sheconomy.in"
      poster={poster}
      title={title}
    />
  )
}

function vimeoEmbedHtml(src: string): string {
  const safe = src.replace(/"/g, '&quot;')
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<meta name="referrer" content="strict-origin-when-cross-origin"/>
<style>html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style>
</head><body>
<iframe src="${safe}" title="Vimeo" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
</body></html>`
}

function NativeYoutubeEmbed({
  youtubeId,
  muted,
  poster,
  title,
}: {
  youtubeId: string
  muted: boolean
  poster: string | null
  title: string
}) {
  const embedUri = youtubeEmbedUrl(youtubeId, {
    autoplay: true,
    muted,
    origin: NATIVE_YT_ORIGIN,
  })

  // Prefer direct embed URI + Referer header (fixes Error 152-4 / 153 in RN WebView).
  // HTML+baseUrl is the fallback when headers are ignored on some Android versions.
  return (
    <NativeYoutubeWebView
      embedUri={embedUri}
      htmlFallback={youtubeEmbedHtml(youtubeId, muted)}
      poster={poster}
      title={title}
      watchUrl={`https://www.youtube.com/watch?v=${youtubeId}`}
    />
  )
}

function NativeYoutubeWebView({
  embedUri,
  htmlFallback,
  poster,
  title,
  watchUrl,
}: {
  embedUri: string
  htmlFallback: string
  poster: string | null
  title: string
  watchUrl: string
}) {
  const [WebView, setWebView] = useState<React.ComponentType<{
    source:
      | { uri: string; headers?: Record<string, string> }
      | { html: string; baseUrl?: string }
    style: object
    allowsFullscreenVideo?: boolean
    allowsInlineMediaPlayback?: boolean
    mediaPlaybackRequiresUserAction?: boolean
    javaScriptEnabled?: boolean
    domStorageEnabled?: boolean
    startInLoadingState?: boolean
    originWhitelist?: string[]
    mixedContentMode?: string
    userAgent?: string
    onError?: () => void
    onHttpError?: () => void
  }> | null>(null)
  const [mode, setMode] = useState<'uri' | 'html'>('uri')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    void import('react-native-webview')
      .then((module) => setWebView(() => module.WebView as never))
      .catch(() => setFailed(true))
  }, [])

  if (failed) {
    return (
      <YoutubeUnavailableFallback poster={poster} title={title} watchUrl={watchUrl} />
    )
  }

  if (!WebView) {
    return poster ? (
      <Image src={poster} width="100%" height="100%" objectFit="cover" alt={title} />
    ) : (
      <YStack flex={1} backgroundColor="#111" />
    )
  }

  const source =
    mode === 'uri'
      ? {
          uri: embedUri,
          headers: {
            Referer: NATIVE_YT_ORIGIN,
            'Referrer-Policy': 'strict-origin-when-cross-origin',
          },
        }
      : { html: htmlFallback, baseUrl: NATIVE_YT_ORIGIN }

  return (
    <WebView
      key={`${mode}-${mutedKey(embedUri)}`}
      source={source}
      style={{ flex: 1, backgroundColor: '#000' }}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      originWhitelist={['*']}
      mixedContentMode="always"
      userAgent={NATIVE_YT_USER_AGENT}
      onError={() => {
        if (mode === 'uri') {
          setMode('html')
          return
        }
        setFailed(true)
      }}
      onHttpError={() => {
        if (mode === 'uri') {
          setMode('html')
          return
        }
        setFailed(true)
      }}
    />
  )
}

function mutedKey(embedUri: string): string {
  try {
    return new URL(embedUri).searchParams.get('mute') ?? '1'
  } catch {
    return '1'
  }
}

function YoutubeUnavailableFallback({
  poster,
  title,
  watchUrl,
}: {
  poster: string | null
  title: string
  watchUrl: string
}) {
  return (
    <YStack
      flex={1}
      backgroundColor="#111"
      alignItems="center"
      justifyContent="center"
      cursor="pointer"
      onPress={() => {
        void openExternalUrl(watchUrl)
      }}
    >
      {poster ? (
        <Image src={poster} width="100%" height="100%" objectFit="cover" alt={title} />
      ) : null}
      <YStack
        position="absolute"
        alignItems="center"
        gap={8}
        paddingHorizontal={16}
        paddingVertical={12}
        borderRadius={12}
        backgroundColor="rgba(0,0,0,0.72)"
      >
        <Icons.Play size={28} color="#fff" fill="#fff" />
        <Text fontSize={13} fontWeight="700" color="#fff">
          Watch on YouTube
        </Text>
      </YStack>
    </YStack>
  )
}

function NativeHtmlEmbed({
  html,
  baseUrl,
  poster,
  title,
}: {
  html: string
  baseUrl: string
  poster: string | null
  title: string
}) {
  const [WebView, setWebView] = useState<React.ComponentType<{
    source: { html: string; baseUrl?: string }
    style: object
    allowsFullscreenVideo?: boolean
    allowsInlineMediaPlayback?: boolean
    mediaPlaybackRequiresUserAction?: boolean
    javaScriptEnabled?: boolean
    domStorageEnabled?: boolean
    startInLoadingState?: boolean
    originWhitelist?: string[]
    mixedContentMode?: string
    userAgent?: string
    onError?: () => void
  }> | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    void import('react-native-webview')
      .then((module) => setWebView(() => module.WebView as never))
      .catch(() => setFailed(true))
  }, [])

  if (failed) {
    return poster ? (
      <Image src={poster} width="100%" height="100%" objectFit="cover" alt={title} />
    ) : (
      <YStack flex={1} backgroundColor="#111" />
    )
  }

  if (!WebView) {
    return poster ? (
      <Image src={poster} width="100%" height="100%" objectFit="cover" alt={title} />
    ) : (
      <YStack flex={1} backgroundColor="#111" />
    )
  }

  return (
    <WebView
      key={html.slice(0, 120)}
      source={{ html, baseUrl }}
      style={{ flex: 1, backgroundColor: '#000' }}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled
      domStorageEnabled
      startInLoadingState
      originWhitelist={['*']}
      mixedContentMode="always"
      userAgent={NATIVE_YT_USER_AGENT}
      onError={() => setFailed(true)}
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
