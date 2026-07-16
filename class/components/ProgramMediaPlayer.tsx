import { createElement, useEffect, useRef, useState } from 'react'
import { Image, Platform } from 'react-native'

import { YoutubeWatchPlayer } from '~/class/components/YoutubeWatchPlayer'
import { extractYoutubeVideoId, getProgramThumbnailUrl, type Program } from '~/class/lib/programs'
import { MediaLightbox } from '~/components/media/MediaLightbox'
import { Button, Icons, Text, YStack } from '~/components/ui'
import { isVideoMediaUrl } from '~/community/lib/post-media'
import { videoSrcWithFirstFrame } from '~/lib/media/video-thumbnail'
import { openUrl } from '~/lib/platform/openUrl'
import { useAppUi } from '~/lib/theme/useAppUi'

type ProgramMediaPlayerProps = {
  program: Program
  /** When true, media attempts to start automatically (detail watch). */
  autoPlay?: boolean
  onEnded?: () => void
}

export function ProgramMediaPlayer({
  program,
  autoPlay = true,
  onEnded,
}: ProgramMediaPlayerProps) {
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

  const youtubeId = program.video_url ? extractYoutubeVideoId(program.video_url) : null
  if (youtubeId) {
    return (
      <YoutubeWatchPlayer
        youtubeId={youtubeId}
        title={program.title}
        autoPlay={autoPlay}
        onEnded={onEnded}
      />
    )
  }

  if (program.video_url && isVideoMediaUrl(program.video_url)) {
    if (Platform.OS === 'web') {
      return (
        <WebFileWatchPlayer
          src={program.video_url}
          poster={poster}
          autoPlay={autoPlay}
          onEnded={onEnded}
        />
      )
    }
    return (
      <NativeFileWatchPlayer
        uri={program.video_url}
        posterUri={poster}
        autoPlay={autoPlay}
        onEnded={onEnded}
      />
    )
  }

  if (Platform.OS === 'web') {
    return (
      <WebProgramMediaPlayer
        program={program}
        mediaUrl={mediaUrl}
        poster={poster}
        autoPlay={autoPlay}
        onEnded={onEnded}
      />
    )
  }

  return (
    <NativeProgramMediaPlayer
      program={program}
      mediaUrl={mediaUrl}
      poster={poster}
      autoPlay={autoPlay}
      onEnded={onEnded}
    />
  )
}

function WebFileWatchPlayer({
  src,
  poster,
  autoPlay,
  onEnded,
}: {
  src: string
  poster: string | null
  autoPlay: boolean
  onEnded?: () => void
}) {
  const ref = useRef<HTMLVideoElement | null>(null)
  const onEndedRef = useRef(onEnded)
  onEndedRef.current = onEnded

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const handleEnded = () => onEndedRef.current?.()
    node.addEventListener('ended', handleEnded)
    return () => node.removeEventListener('ended', handleEnded)
  }, [])

  return createElement('video', {
    ref,
    src: videoSrcWithFirstFrame(src),
    controls: true,
    playsInline: true,
    autoPlay,
    preload: 'metadata',
    poster: poster ?? undefined,
    style: { width: '100%', aspectRatio: '16 / 9', borderRadius: 12, backgroundColor: '#000' },
  })
}

function NativeFileWatchPlayer({
  uri,
  posterUri,
  autoPlay,
  onEnded,
}: {
  uri: string
  posterUri: string | null
  autoPlay: boolean
  onEnded?: () => void
}) {
  const [NativeVideoFile, setNativeVideoFile] = useState<React.ComponentType<{
    uri: string
    posterUri?: string | null
    autoPlay?: boolean
    onEnded?: () => void
  }> | null>(null)

  useEffect(() => {
    void import('~/lib/native/NativeMediaPlayers').then((module) => {
      setNativeVideoFile(() => module.NativeVideoFile)
    })
  }, [])

  if (!NativeVideoFile) {
    return <YStack width="100%" aspectRatio={16 / 9} borderRadius={12} backgroundColor="#000" />
  }

  return (
    <NativeVideoFile uri={uri} posterUri={posterUri} autoPlay={autoPlay} onEnded={onEnded} />
  )
}

function WebProgramMediaPlayer({
  program,
  mediaUrl,
  poster,
  autoPlay,
  onEnded,
}: {
  program: Program
  mediaUrl: string
  poster: string | null
  autoPlay: boolean
  onEnded?: () => void
}) {
  if (program.video_url && /\.(mp4|webm|m3u8)(\?|$)/i.test(program.video_url)) {
    return (
      <WebFileWatchPlayer
        src={program.video_url}
        poster={poster}
        autoPlay={autoPlay}
        onEnded={onEnded}
      />
    )
  }

  if (program.audio_url) {
    return createElement('audio', {
      src: program.audio_url,
      controls: true,
      autoPlay,
      onEnded: () => onEnded?.(),
      style: { width: '100%' },
    })
  }

  return <OpenMediaFallback program={program} mediaUrl={mediaUrl} />
}

function NativeProgramMediaPlayer({
  program,
  mediaUrl,
  poster,
  autoPlay,
  onEnded,
}: {
  program: Program
  mediaUrl: string
  poster: string | null
  autoPlay: boolean
  onEnded?: () => void
}) {
  const ui = useAppUi()
  const [NativeVideoFile, setNativeVideoFile] = useState<React.ComponentType<{
    uri: string
    posterUri?: string | null
    autoPlay?: boolean
    onEnded?: () => void
  }> | null>(null)
  const [NativeAudioFile, setNativeAudioFile] = useState<
    React.ComponentType<{ uri: string; autoPlay?: boolean; onEnded?: () => void }> | null
  >(null)

  useEffect(() => {
    void import('~/lib/native/NativeMediaPlayers').then((module) => {
      setNativeVideoFile(() => module.NativeVideoFile)
      setNativeAudioFile(() => module.NativeAudioFile)
    })
  }, [])

  if (program.video_url && /\.(mp4|webm|m3u8)(\?|$)/i.test(program.video_url) && NativeVideoFile) {
    return (
      <NativeVideoFile
        uri={program.video_url}
        posterUri={poster}
        autoPlay={autoPlay}
        onEnded={onEnded}
      />
    )
  }

  if (program.audio_url && NativeAudioFile) {
    return <NativeAudioFile uri={program.audio_url} autoPlay={autoPlay} onEnded={onEnded} />
  }

  if (!NativeVideoFile && !NativeAudioFile) {
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
