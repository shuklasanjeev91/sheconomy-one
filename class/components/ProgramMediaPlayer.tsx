import { createElement } from 'react'
import { Platform } from 'react-native'

import { extractYoutubeVideoId, type Program } from '~/class/lib/programs'
import { Icons, Text, YStack } from '~/components/ui'
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
          createElement('img', {
            src: program.image_url,
            alt: program.title,
            style: { width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 },
          })
        ) : (
          <>
            <Icons.Radio size={40} color={ui.icon} />
            <Text color={ui.textSecondary}>Media unavailable</Text>
          </>
        )}
      </YStack>
    )
  }

  if (program.video_url) {
    const youtubeId = extractYoutubeVideoId(program.video_url)
    if (youtubeId && Platform.OS === 'web') {
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

    if (Platform.OS === 'web' && /\.(mp4|webm|m3u8)(\?|$)/i.test(program.video_url)) {
      return createElement('video', {
        src: program.video_url,
        controls: true,
        playsInline: true,
        style: { width: '100%', aspectRatio: '16 / 9', borderRadius: 12, backgroundColor: '#000' },
      })
    }
  }

  if (program.audio_url && Platform.OS === 'web') {
    return createElement('audio', {
      src: program.audio_url,
      controls: true,
      style: { width: '100%' },
    })
  }

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
      <Text fontSize={14} fontWeight="600" color={ui.brand}>
        Open media
      </Text>
      <Text fontSize={13} color={ui.textSecondary} textAlign="center">
        {mediaUrl}
      </Text>
    </YStack>
  )
}