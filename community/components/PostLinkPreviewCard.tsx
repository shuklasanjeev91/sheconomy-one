import { useState } from 'react'
import { Linking, Platform } from 'react-native'

import type { PostLinkPreview } from '~/community/lib/community'
import { useCommunityUi } from '~/community/lib/community-theme'
import { getVideoEmbed } from '~/lib/link-preview'
import { Icons, Image, Spinner, Text, XStack, YStack } from '~/components/ui'

type PostLinkPreviewCardProps = {
  preview: PostLinkPreview | null
  /** Show a loading skeleton while the preview is being fetched (composer). */
  loading?: boolean
  /** When provided, renders a remove (X) button — used in the composer. */
  onRemove?: () => void
}

const MEDIA_HEIGHT = 220

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** professional Open Graph unfurl card for a URL shared in a post. */
export function PostLinkPreviewCard({ preview, loading, onRemove }: PostLinkPreviewCardProps) {
  const ui = useCommunityUi()
  const [playing, setPlaying] = useState(false)

  if (loading && !preview) {
    return (
      <XStack
        alignItems="center"
        gap={10}
        borderWidth={1}
        borderColor={ui.border}
        borderRadius={12}
        padding={12}
        backgroundColor={ui.cardBg}
      >
        <Spinner size="small" color={ui.brand} />
        <Text fontSize={13} color={ui.textMuted}>
          Loading link preview…
        </Text>
      </XStack>
    )
  }

  if (!preview) return null

  const site = preview.siteName || hostFromUrl(preview.url)
  const embed = getVideoEmbed(preview)
  const isWeb = Platform.OS === 'web'

  const openLink = () => {
    Linking.openURL(preview.url).catch(() => {})
  }

  // Inline player (web only). Native falls back to opening the link.
  const showPlayer = playing && embed && isWeb

  return (
    <YStack
      position="relative"
      borderWidth={1}
      borderColor={ui.border}
      borderRadius={12}
      overflow="hidden"
      backgroundColor={ui.cardBg}
    >
      {showPlayer ? (
        <YStack width="100%" height={MEDIA_HEIGHT} backgroundColor="#000">
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
      ) : (
        <YStack>
          {preview.image || embed ? (
            <YStack
              position="relative"
              cursor="pointer"
              pressStyle={{ opacity: 0.9 }}
              onPress={() => {
                if (embed && isWeb) setPlaying(true)
                else openLink()
              }}
            >
              {preview.image ? (
                <Image
                  src={preview.image}
                  width="100%"
                  height={MEDIA_HEIGHT}
                  objectFit="cover"
                  alt={preview.title ?? 'Link preview'}
                />
              ) : (
                <YStack width="100%" height={MEDIA_HEIGHT} backgroundColor="#0f0f0f" />
              )}

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
                    width={60}
                    height={60}
                    borderRadius={999}
                    alignItems="center"
                    justifyContent="center"
                    backgroundColor="rgba(0,0,0,0.6)"
                  >
                    <Icons.Play size={28} color="#ffffff" fill="#ffffff" />
                  </YStack>
                </YStack>
              ) : null}
            </YStack>
          ) : null}

          <YStack
            paddingVertical={10}
            paddingHorizontal={12}
            gap={3}
            cursor="pointer"
            hoverStyle={{ backgroundColor: ui.hoverBg }}
            onPress={openLink}
          >
            <Text fontSize={11} fontWeight="600" color={ui.textSubtle} numberOfLines={1}>
              {site.toUpperCase()}
            </Text>
            {preview.title ? (
              <Text fontSize={15} fontWeight="700" color={ui.text} numberOfLines={2}>
                {preview.title}
              </Text>
            ) : null}
            {preview.description ? (
              <Text fontSize={13} color={ui.textMuted} numberOfLines={2}>
                {preview.description}
              </Text>
            ) : null}
          </YStack>
        </YStack>
      )}

      {onRemove ? (
        <XStack
          position="absolute"
          top={8}
          right={8}
          width={28}
          height={28}
          borderRadius={999}
          alignItems="center"
          justifyContent="center"
          backgroundColor="rgba(0,0,0,0.6)"
          cursor="pointer"
          hoverStyle={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
          onPress={(e: { stopPropagation?: () => void }) => {
            e.stopPropagation?.()
            onRemove()
          }}
          aria-label="Remove link preview"
        >
          <Icons.X size={16} color="#ffffff" />
        </XStack>
      ) : null}
    </YStack>
  )
}
