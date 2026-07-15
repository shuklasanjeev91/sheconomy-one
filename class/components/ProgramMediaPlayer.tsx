import { createElement, useEffect, useState } from 'react'
import { Image, Platform } from 'react-native'

import { extractYoutubeVideoId, getProgramThumbnailUrl, type Program } from '~/class/lib/programs'
import { AutoplayVideo } from '~/components/media/AutoplayVideo'
import { MediaLightbox } from '~/components/media/MediaLightbox'
import { Button, Icons, Text, YStack } from '~/components/ui'
import { isVideoMediaUrl } from '~/community/lib/post-media'
import { videoSrcWithFirstFrame } from '~/lib/media/video-thumbnail'
import { openUrl } from '~/lib/platform/openUrl'
import { useAppUi } from '~/lib/theme/useAppUi'

type ProgramMediaPlayerProps = {
  program: Program
}

export function ProgramMediaPlayer({ program }: ProgramMediaPlayerProps) {
  const ui = useAppUi()
  const mediaUrl = program.video_url || program.audio_url
  const poster = getProgramThumbnailUrl(program)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  if (!mediaUrl) {
    return (
      <>
        <YStack
          width="100%"
          aspectRatio={16 / 9}
          borderRadius={12}
          backgroundColor={ui.surfaceMuted}
          alignItems="center"
          justifyContent="center"
          gap="$2"
          overflow="hidden"
          cursor={poster ? 'zoom-in' : undefined}
          onPress={poster ? () => setLightboxOpen(true) : undefined}
        >
          {poster ? (
            Platform.OS === 'web' ? (
              createElement('img', {
                src: poster,
                alt: program.title,
                style: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 },
              })
            ) : (
              <Image
                source={{ uri: poster }}
                style={{ width: '100%', height: '100%', borderRadius: 12 }}
                resizeMode="cover"
                accessibilityLabel={program.title}
              />
            )
          ) : (
            <>
              <Icons.Radio size={40} color={ui.icon} />
              <Text color={ui.textSecondary}>Media unavailable</Text>
            </>
          )}
        </YStack>
        {poster ? (
          <MediaLightbox
            items={[{ url: poster, kind: 'image', alt: program.title }]}
            open={lightboxOpen}
            onOpenChange={setLightboxOpen}
          />
        ) : null}
      </>
    )
  }

  // LinkedIn-style muted autoplay for program detail video.
  if (program.video_url && (program.video_url.includes('youtu') || isVideoMediaUrl(program.video_url))) {
    return (
      <YStack width="100%" borderRadius={12} overflow="hidden">
        <AutoplayVideo
          src={program.video_url}
          posterUrl={poster}
          aspectRatio={16 / 9}
          objectFit="contain"
          autoplayInView
          borderRadius={12}
        />
      </YStack>
    )
  }

  if (Platform.OS === 'web') {
    return <WebProgramMediaPlayer program={program} mediaUrl={mediaUrl} poster={poster} />
  }

  return <NativeProgramMediaPlayer program={program} mediaUrl={mediaUrl} poster={poster} />
}

function WebProgramMediaPlayer({
  program,
  mediaUrl,
  poster,
}: {
  program: Program
  mediaUrl: string
  poster: string | null
}) {
  if (program.video_url) {
    const youtubeId = extractYoutubeVideoId(program.video_url)
    if (youtubeId) {
      return createElement('div', {
        style: {
          width: '100%',
          aspectRatio: '16 / 9',
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: '#000',
        },
        children: createElement('iframe', {
          src: `https://www.youtube.com/embed/${youtubeId}`,
          title: program.title,
          style: { width: '100%', height: '100%', border: 0 },
          allow:
            'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
          allowFullScreen: true,
        }),
      })
    }

    if (/\.(mp4|webm|m3u8)(\?|$)/i.test(program.video_url)) {
      return createElement('video', {
        src: videoSrcWithFirstFrame(program.video_url),
        controls: true,
        playsInline: true,
        preload: 'metadata',
        poster: poster ?? undefined,
        style: { width: '100%', aspectRatio: '16 / 9', borderRadius: 12, backgroundColor: '#000' },
      })
    }
  }

  if (program.audio_url) {
    return createElement('audio', {
      src: program.audio_url,
      controls: true,
      style: { width: '100%' },
    })
  }

  return <OpenMediaFallback program={program} mediaUrl={mediaUrl} />
}

function NativeProgramMediaPlayer({
  program,
  mediaUrl,
  poster,
}: {
  program: Program
  mediaUrl: string
  poster: string | null
}) {
  const ui = useAppUi()
  const [WebViewComponent, setWebViewComponent] = useState<React.ComponentType<any> | null>(null)
  const [NativeVideoFile, setNativeVideoFile] = useState<
    React.ComponentType<{ uri: string; posterUri?: string | null; autoPlay?: boolean }> | null
  >(null)
  const [NativeAudioFile, setNativeAudioFile] = useState<React.ComponentType<{ uri: string }> | null>(
    null,
  )

  useEffect(() => {
    void import('react-native-webview').then((module) => setWebViewComponent(() => module.WebView))
    void import('~/lib/native/NativeMediaPlayers').then((module) => {
      setNativeVideoFile(() => module.NativeVideoFile)
      setNativeAudioFile(() => module.NativeAudioFile)
    })
  }, [])

  if (program.video_url) {
    const youtubeId = extractYoutubeVideoId(program.video_url)
    if (youtubeId && WebViewComponent) {
      const WebView = WebViewComponent
      return (
        <YStack width="100%" aspectRatio={16 / 9} borderRadius={12} overflow="hidden" backgroundColor="#000">
          <WebView
            source={{ uri: `https://www.youtube.com/embed/${youtubeId}` }}
            style={{ flex: 1 }}
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
          />
        </YStack>
      )
    }

    if (/\.(mp4|webm|m3u8)(\?|$)/i.test(program.video_url) && NativeVideoFile) {
      const VideoFile = NativeVideoFile
      return <VideoFile uri={program.video_url} posterUri={poster} autoPlay />
    }
  }

  if (program.audio_url && NativeAudioFile) {
    const AudioFile = NativeAudioFile
    return <AudioFile uri={program.audio_url} />
  }

  if (!WebViewComponent && !NativeVideoFile && !NativeAudioFile) {
    return (
      <YStack width="100%" aspectRatio={16 / 9} alignItems="center" justifyContent="center">
        <Icons.Radio size={28} color={ui.brand} />
      </YStack>
    )
  }

  return <OpenMediaFallback program={program} mediaUrl={mediaUrl} />
}

function OpenMediaFallback({ program, mediaUrl }: { program: Program; mediaUrl: string }) {
  const ui = useAppUi()

  return (
    <YStack
      width="100%"
      aspectRatio={16 / 9}
      borderRadius={12}
      backgroundColor={ui.surfaceMuted}
      alignItems="center"
      justifyContent="center"
      gap="$2"
      padding="$4"
    >
      <Icons.Play size={36} color={ui.brand} />
      <Button size="$3" onPress={() => void openUrl(mediaUrl)}>
        Open media
      </Button>
      <Text fontSize={13} color={ui.textSecondary} textAlign="center" numberOfLines={2}>
        {program.title}
      </Text>
    </YStack>
  )
}
