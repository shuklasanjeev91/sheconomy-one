import type { PostLinkPreview } from '~/community/lib/community'
import { useCommunityUi } from '~/community/lib/community-theme'
import { AutoplayVideo } from '~/components/media/AutoplayVideo'
import { getVideoEmbed } from '~/lib/link-preview'
import { getVideoPosterUrl } from '~/lib/media/video-thumbnail'
import { Icons, Image, Spinner, Text, XStack, YStack } from '~/components/ui'
import { openExternalUrl } from '~/lib/platform/openUrl'

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

function decodeBasicHtmlEntities(value: string | null | undefined): string | null {
  if (!value) return null
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#10;/g, '\n')
}

/** professional Open Graph unfurl card for a URL shared in a post. */
export function PostLinkPreviewCard({ preview, loading, onRemove }: PostLinkPreviewCardProps) {
  const ui = useCommunityUi()

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

  const site = decodeBasicHtmlEntities(preview.siteName || hostFromUrl(preview.url))
  const embed = getVideoEmbed(preview)
  const coverImage = preview.image || getVideoPosterUrl(preview.url)
  const title = decodeBasicHtmlEntities(preview.title)
  const description = decodeBasicHtmlEntities(preview.description)

  const openLink = () => {
    void openExternalUrl(preview.url)
  }

  if (embed) {
    // Prefer resolved embed/file src so YouTube `/embed/ID` and Vimeo players work.
    const videoSrc = embed.src
    return (
      <YStack
        position="relative"
        borderWidth={1}
        borderColor={ui.border}
        borderRadius={12}
        overflow="hidden"
        backgroundColor={ui.cardBg}
      >
        <AutoplayVideo
          src={videoSrc}
          posterUrl={coverImage}
          height={MEDIA_HEIGHT}
          objectFit="contain"
          autoplayInView
        />
        <YStack
          paddingVertical={10}
          paddingHorizontal={12}
          gap={3}
          cursor="pointer"
          hoverStyle={{ backgroundColor: ui.hoverBg }}
          onPress={openLink}
        >
          <Text fontSize={11} fontWeight="600" color={ui.textMuted} numberOfLines={1}>
            {site.toUpperCase()}
          </Text>
          {title ? (
            <Text fontSize={15} fontWeight="700" color={ui.text} numberOfLines={2}>
              {title}
            </Text>
          ) : null}
          {description ? (
            <Text fontSize={13} color={ui.textMuted} numberOfLines={2}>
              {description}
            </Text>
          ) : null}
        </YStack>
        {onRemove ? <RemovePreviewButton onRemove={onRemove} /> : null}
      </YStack>
    )
  }

  return (
    <YStack
      position="relative"
      borderWidth={1}
      borderColor={ui.border}
      borderRadius={12}
      overflow="hidden"
      backgroundColor={ui.cardBg}
    >
      {coverImage ? (
        <YStack cursor="pointer" pressStyle={{ opacity: 0.9 }} onPress={openLink}>
          <Image
            src={coverImage}
            width="100%"
            height={MEDIA_HEIGHT}
            objectFit="cover"
            alt={title ?? 'Link preview'}
          />
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
        <Text fontSize={11} fontWeight="600" color={ui.textMuted} numberOfLines={1}>
          {site.toUpperCase()}
        </Text>
        {title ? (
          <Text fontSize={15} fontWeight="700" color={ui.text} numberOfLines={2}>
            {title}
          </Text>
        ) : null}
        {description ? (
          <Text fontSize={13} color={ui.textMuted} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </YStack>
      {onRemove ? <RemovePreviewButton onRemove={onRemove} /> : null}
    </YStack>
  )
}

function RemovePreviewButton({ onRemove }: { onRemove: () => void }) {
  return (
    <XStack
      position="absolute"
      top={8}
      right={8}
      zIndex={6}
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
  )
}
