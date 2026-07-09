import { createElement, useEffect, useState } from 'react'
import { Image, Platform } from 'react-native'

import { extractYoutubeVideoId, type Program } from '~/class/lib/programs'
import { Button, Icons, Text, YStack } from '~/components/ui'
import { openUrl } from '~/lib/platform/openUrl'
import { useAppUi } from '~/lib/theme/useAppUi'

type ProgramMediaPlayerProps = {
  program: Program
}

export function ProgramMediaPlayer({ program }: ProgramMediaPlayerProps) {
  const ui = useAppUi()
  const mediaUrl = program.video_url || program.audio_url

  if (!mediaUrl) {
    return (
      <YStack
        width="100%"
        aspectRatio={16 / 9}
        borderRadius={12}
        backgroundColor={ui.surfaceMuted}
        alignItems="center"
        justifyContent="center"
        gap="$2"
      >
        {program.image_url ? (
          Platform.OS === 'web' ? (
            createElement('img', {
              src: program.image_url,
              alt: program.title,
              style: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 },
            })
          ) : (
            <Image
              source={{ uri: program.image_url }}
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
    )
  }

  if (Platform.OS === 'web') {
    return <WebProgramMediaPlayer program={program} mediaUrl={mediaUrl} />
  }

  return <NativeProgramMediaPlayer program={program} mediaUrl={mediaUrl} />
}

function WebProgramMediaPlayer({ program, mediaUrl }: { program: Program; mediaUrl: string }) {
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
        src: program.video_url,
        controls: true,
        playsInline: true,
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

function NativeProgramMediaPlayer({ program, mediaUrl }: { program: Program; mediaUrl: string }) {
  const ui = useAppUi()
  const [WebViewComponent, setWebViewComponent] = useState<React.ComponentType<any> | null>(null)
  const [VideoComponent, setVideoComponent] = useState<React.ComponentType<any> | null>(null)

  useEffect(() => {
    void import('react-native-webview').then((module) => setWebViewComponent(() => module.WebView))
    void import('expo-av').then((module) => {
      setVideoComponent(() => module.Video)
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

    if (/\.(mp4|webm|m3u8)(\?|$)/i.test(program.video_url) && VideoComponent) {
      const Video = VideoComponent
      return (
        <YStack width="100%" aspectRatio={16 / 9} borderRadius={12} overflow="hidden" backgroundColor="#000">
          <Video
            source={{ uri: program.video_url }}
            useNativeControls
            resizeMode="contain"
            style={{ width: '100%', height: '100%' }}
          />
        </YStack>
      )
    }
  }

  if (program.audio_url && VideoComponent) {
    const Video = VideoComponent
    return (
      <YStack width="100%" borderRadius={12} overflow="hidden" backgroundColor={ui.surfaceMuted} padding="$2">
        <Video
          source={{ uri: program.audio_url }}
          useNativeControls
          resizeMode="contain"
          style={{ width: '100%', height: 56 }}
        />
      </YStack>
    )
  }

  if (!WebViewComponent && !VideoComponent) {
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
