import { useEffect, useState } from 'react'
import { Platform } from 'react-native'

import { fetchLinkPreview, getVideoEmbed, type LinkPreview } from '~/chat/lib/link-preview'
import { useChatTheme } from '~/chat/lib/chat-theme'
import { Icons, Image, Text, YStack } from '~/components/ui'
import { openExternalUrl } from '~/lib/platform/openUrl'

type LinkPreviewCardProps = {
  url: string
  isOwn: boolean
}

const CARD_WIDTH = 248
const MEDIA_HEIGHT = 124

/** Rich Open Graph preview card rendered inside a text bubble. */
export function LinkPreviewCard({ url, isOwn }: LinkPreviewCardProps) {
  const chat = useChatTheme()
  const [preview, setPreview] = useState<LinkPreview | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchLinkPreview(url).then((result) => {
      if (!cancelled) setPreview(result)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  if (!preview) return null

  const accent = isOwn ? chat.bubbleMetaOut : chat.brand
  const titleColor = isOwn ? chat.bubbleOutText : chat.bubbleInText
  const descColor = isOwn ? chat.bubbleMetaOut : chat.textSecondary

  const embed = getVideoEmbed(preview)
  const isWeb = Platform.OS === 'web'
  const showPlayer = playing && embed && isWeb

  const openLink = () => {
    void openExternalUrl(preview.url)
  }

  return (
    <YStack
      marginBottom={4}
      borderRadius={8}
      overflow="hidden"
      backgroundColor={isOwn ? 'rgba(0,0,0,0.08)' : chat.quoteBg}
      borderLeftWidth={3}
      borderLeftColor={accent}
      width={CARD_WIDTH}
    >
      {showPlayer ? (
        <YStack width={CARD_WIDTH} height={MEDIA_HEIGHT} backgroundColor="#000">
          {embed.kind === 'iframe' ? (
            <iframe
              src={`${embed.src}${embed.src.includes('?') ? '&' : '?'}autoplay=1`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              title={preview.title ?? 'Video'}
            />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={embed.src}
              poster={preview.image ?? undefined}
              style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
              controls
              autoPlay
            />
          )}
        </YStack>
      ) : preview.image ? (
        <YStack
          position="relative"
          cursor="pointer"
          pressStyle={{ opacity: 0.85 }}
          onPress={() => {
            if (embed && isWeb) setPlaying(true)
            else openLink()
          }}
        >
          <Image
            src={preview.image}
            width={CARD_WIDTH}
            height={MEDIA_HEIGHT}
            objectFit="cover"
            alt="Link preview"
          />
          {embed ? (
            <YStack
              position="absolute"
              top={0}
              left={0}
              right={0}
              bottom={0}
              alignItems="center"
              justifyContent="center"
            >
              <YStack
                width={44}
                height={44}
                borderRadius={999}
                alignItems="center"
                justifyContent="center"
                backgroundColor="rgba(0,0,0,0.6)"
              >
                <Icons.Play size={20} color="#ffffff" fill="#ffffff" />
              </YStack>
            </YStack>
          ) : null}
        </YStack>
      ) : null}

      <YStack
        paddingVertical={7}
        paddingHorizontal={9}
        gap={2}
        cursor="pointer"
        pressStyle={{ opacity: 0.85 }}
        onPress={openLink}
      >
        {preview.siteName ? (
          <Text fontSize={11} fontWeight="600" color={accent} numberOfLines={1}>
            {preview.siteName}
          </Text>
        ) : null}
        {preview.title ? (
          <Text fontSize={13.5} fontWeight="700" color={titleColor} numberOfLines={2}>
            {preview.title}
          </Text>
        ) : null}
        {preview.description ? (
          <Text fontSize={12} color={descColor} numberOfLines={2}>
            {preview.description}
          </Text>
        ) : null}
      </YStack>
    </YStack>
  )
}
